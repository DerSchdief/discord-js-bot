const fs = require("fs");
const fuzzysort = require("fuzzysort");
const { 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown, EmbedBuilder, BaseInteraction, 
    PermissionsBitField, StringSelectMenuOptionBuilder, StringSelectMenuBuilder
} = require("discord.js");
const https = require("https");
const http = require("http");
const cron = require("node-cron");

let client;
const saveClient = (input) => {
    client = input;
}

const cronTasks = [];

const scheduleTasks = () => {
    client.logger.debug("Scheduling tasks...");

    // check alerts every day at 00:00:10 GMT
    if (client.config.VALORANT.refreshSkins) cronTasks.push(cron.schedule(client.config.VALORANT.refreshSkins, checkAlerts, { timezone: "GMT" }));

    // check for new valorant version every 15mins
    if (client.config.VALORANT.checkGameVersion) cronTasks.push(cron.schedule(client.config.VALORANT.checkGameVersion, () => fetchData(null, true)));

    // if login queue is enabled, process an item every 3 seconds
    if (client.config.VALORANT.useLoginQueue && client.config.VALORANT.loginQueueInterval) startAuthQueue();

    // if send console to discord channel is enabled, send console output every 10 seconds
    if (client.config.VALORANT.logToChannel && client.config.VALORANT.logFrequency) cronTasks.push(cron.schedule(client.config.VALORANT.logFrequency, sendConsoleOutput));

    // check for a new riot client version (new user agent) every 15mins
    if (client.config.VALORANT.updateUserAgent) cronTasks.push(cron.schedule(client.config.VALORANT.updateUserAgent, fetchRiotClientVersion));
}

const destroyTasks = () => {
    client.logger.debug("Destroying scheduled tasks...");
    for (const task of cronTasks)
        task.stop();
    cronTasks.length = 0;
}

const settingsChoices = [];
setTimeout(() => {
    for (const setting of Object.keys(settings).filter(settingIsVisible)) {
        settingsChoices.push({
            name: settingName(setting),
            value: setting
        });
    }
});


/* Alert format: {
*     uuid: skin uuid
*     channel_id: discord text channel id the alert was sent in
* }
* Each user should have one alert per skin.
*/

const addAlert = (id, alert) => {
    const user = getUser(id);
    if(!user) return;

    user.alerts.push(alert);
    saveUser(user);
}

const alertsForUser = (id, account=null) => {
    if(account === -1) { // -1 to get all alerts for user across accounts
        const user = readUserJson(id);
        if(!user) return [];

        return user.accounts.map(account => account.alerts).flat();
    }

    const user = getUser(id, account);
    if(user) return user.alerts;
    return [];
}

const alertExists = (id, uuid) => {
    return alertsForUser(id).find(alert => alert.uuid === uuid) || false;
}

const filteredAlertsForUser = async (interaction) => {
    let alerts = alertsForUser(interaction.user.id);

    // bring the alerts in this channel to the top
    const alertPriority = (alert) => {
        if(alert.channel_id === interaction.channelId) return 2;
        const channel = client.channels.cache.get(alert.channel_id)
        if(interaction.guild && channel && channel.client.channels.cache.get(alert.channel_id).guildId === interaction.guild.id) return 1;
        return 0;
    }
    alerts.sort((alert1, alert2) => alertPriority(alert2) - alertPriority(alert1));

    return alerts;
}

const alertsPerChannelPerGuild = async () => {
    const guilds = {};
    for(const id of getUserList()) {
        const alerts = alertsForUser(id, -1);
        for(const alert of alerts) {
            const guildId = await getChannelGuildId(alert.channel_id);

            if(!(guildId in guilds)) guilds[guildId] = {};
            if(!(alert.channel_id in guilds[guildId])) guilds[guildId][alert.channel_id] = 1;
            else guilds[guildId][alert.channel_id]++;
        }
    }
    return guilds;
}

const removeAlert = (id, uuid) => {
    const user = getUser(id);
    const alertCount = user.alerts.length;
    user.alerts = user.alerts.filter(alert => alert.uuid !== uuid);
    saveUser(user);
    return alertCount > user.alerts.length;
}

const checkAlerts = async () => {
    if(client.shard && !client.shard.ids.includes(0)) return; // only run on the first shard

    client.logger.debug("Checking new shop skins for alerts...");

    try {
        let shouldWait = false;

        for(const id of getUserList()) {
            try {
                let credsExpiredAlerts = false;

                const userJson = readUserJson(id);
                if(!userJson) continue;

                const accountCount = userJson.accounts.length;
                for(let i = 1; i <= accountCount; i++) {

                    const rawUserAlerts = alertsForUser(id, i);
                    const dailyShopChannel = getSetting(id, "dailyShop");
                    if(!rawUserAlerts?.length && !dailyShopChannel) continue;
                    if(!rawUserAlerts?.length && dailyShopChannel && i !== userJson.currentAccount) continue;

                    if(shouldWait) {
                        await wait(client.config.VALORANT.delayBetweenAlerts); // to prevent being ratelimited
                        shouldWait = false;
                    }

                    const valorantUser = getUser(id, i);
                    const discordUser = client.users.cache.get(id);
                    const discordUsername = discordUser ? discordUser.username : id;
                    client.logger.debug(`Checking user ${discordUsername}'s ${valorantUser.username} account (${i}/${accountCount}) for alerts...`);

                    const userAlerts = removeDupeAlerts(rawUserAlerts);
                    if(userAlerts.length !== rawUserAlerts.length) {
                        valorantUser.alerts = userAlerts;
                        saveUser(valorantUser, i);
                    }

                    let offers;
                    do { // retry loop in case of rate limit or maintenance
                        offers = await getOffers(id, i);
                        shouldWait = valorantUser.auth && !offers.cached;

                        if(!offers.success) {
                            if(offers.maintenance) {
                                console.log("Valorant servers are under maintenance, waiting 15min before continuing alert checks...");
                                await wait(15 * 60 * 1000);
                            }

                            else if(offers.rateLimit) {
                                const waitMs = offers.rateLimit - Date.now();
                                console.error(`I got ratelimited while checking alerts for user ${id} #${i} for ${Math.floor(waitMs / 1000)}s!`);
                                await wait(waitMs);
                            }

                            else {
                                if(!credsExpiredAlerts) {
                                    if(valorantUser.authFailures < client.config.VALORANT.authFailureStrikes) {
                                        valorantUser.authFailures++;
                                        credsExpiredAlerts = userAlerts;
                                    }
                                }

                                deleteUserAuth(valorantUser);
                                break;
                            }
                        }

                    } while(!offers.success);

                    if(offers.success && offers.offers) {
                        if(dailyShopChannel && i === userJson.currentAccount) await sendDailyShop(id, offers, dailyShopChannel, valorantUser);

                        const positiveAlerts = userAlerts.filter(alert => offers.offers.includes(alert.uuid));
                        if(positiveAlerts.length) await sendAlert(id, i, positiveAlerts, offers.expires);
                    }
                }

                if(credsExpiredAlerts) {
                    // user login is invalid
                    const channelsSent = [];
                    for(const alert of credsExpiredAlerts) {
                        if(!channelsSent.includes(alert.channel_id)) {
                            await sendCredentialsExpired(id, alert);
                            channelsSent.push(alert.channel_id);
                        }
                    }
                }
            } catch(e) {
                console.error("There was an error while trying to fetch and send alerts for user " + discordTag(id));
                console.error(e);
            }
        }

        client.logger.debug("Finished checking alerts!");
    } catch(e) {
        // should I send messages in the discord channels?
        console.error("There was an error while trying to send alerts!");
        console.error(e);
    }
}

const sendAlert = async (id, account, alerts, expires, tryOnOtherShard=true) => {
    const user = client.users.cache.get(id);
    const username = user ? user.username : id;

    for(const alert of alerts) {
        const valorantUser = getUser(id, account);
        if(!valorantUser) return;

        const channel = await fetchChannel(alert.channel_id);
        if(!channel) {
            if(client.shard && tryOnOtherShard) {
                sendShardMessage({
                    type: "alert",
                    alerts: [alert],
                    id, account, expires
                });
            }
            continue;
        }

        console.log(`Sending alert for user ${username}...`);

        const skin = await getSkin(alert.uuid);
        console.log(`User ${valorantUser.username} has the skin ${l(skin.names, valorantUser)} in their shop!`);

        await channel.send({
            content: `<@${id}>`,
            embeds: [{
                description: s(valorantUser).info.ALERT_HAPPENED.f({i: id, u: valorantUser.username, s: await skinNameAndEmoji(skin, channel, valorantUser), t: expires}, id),
                color: VAL_COLOR_1,
                thumbnail: {
                    url: skin.icon
                }
            }],
            components: [removeAlertActionRow(id, alert.uuid, s(valorantUser).info.REMOVE_ALERT_BUTTON)]
        }).catch(async e => {
            console.error(`Could not send alert message in #${channel.name}! Do I have the right role?`);

            try { // try to log the alert to the console
                const user = await client.users.fetch(id).catch(() => {});
                if(user) console.error(`Please tell ${user.tag} that the ${skin.name} is in their item shop!`);
            } catch(e) {}

            console.error(e);
        });
    }
}

const sendCredentialsExpired = async (id, alert, tryOnOtherShard=true) => {
    const channel = await fetchChannel(alert.channel_id);
    if(!channel) {
        if(client.shard && tryOnOtherShard) {
            sendShardMessage({
                type: "alertCredentialsExpired",
                id, alert
            });
            return;
        }

        const user = await client.users.fetch(id).catch(() => {});
        if(user) console.error(`Please tell ${user.tag} that their credentials have expired, and that they should /login again. (I can't find the channel where the alert was set up)`);
        return;
    }

    if(channel.guild) {
        const memberInGuild = await channel.guild.members.fetch(id).catch(() => {});
        if(!memberInGuild) return; // the user is no longer in that guild
    }

    const valorantUser = getUser(id);
    if(!valorantUser) return;

    await channel.send({
        content: `<@${id}>`,
        embeds: [{
            description: s(valorantUser).error.AUTH_ERROR_ALERTS_HAPPENED.f({u: id}),
            color: VAL_COLOR_1,
        }]
    }).catch(async e => {
        console.error(`Could not send message in #${channel.name}! Do I have the right role?`);

        try { // try to log the alert to the console
            const user = await client.users.fetch(id).catch(() => {});
            if(user) console.error(`Please tell ${user.tag} that their credentials have expired, and that they should /login again. Also tell them that they should fix their perms.`);
        } catch(e) {}

        console.error(e);
    });
}

const sendDailyShop = async (id, shop, channelId, valorantUser, tryOnOtherShard=true) => {
    const channel = await fetchChannel(channelId);
    if(!channel) {
        if(client.shard && tryOnOtherShard) {
            sendShardMessage({
                type: "dailyShop",
                id, shop, channelId, valorantUser
            });
            return;
        }

        const user = await client.users.fetch(id).catch(() => {});
        if(user) console.error(`Please tell ${user.tag} that the daily shop is out! (I can't find the channel where the alert was set up)`);
        return;
    }

    const rendered = await renderOffers(shop, id, valorantUser, await VPEmoji(id, channel));
    await channel.send({
        content: `<@${id}>`,
        ...rendered
    });
}

const testAlerts = async (interaction) => {
    try {
        const channel = interaction.channel || await fetchChannel(interaction.channel_id);
        await channel.send({
            embeds: [basicEmbed(s(interaction).info.ALERT_TEST)]
        });
        return true;
    } catch(e) {
        console.error(`${interaction.user.tag} tried to /testalerts, but failed!`);
        if(e.code === 50013) console.error("Failed with 'Missing Access' error");
        else if(e.code === 50001) console.error("Failed with 'Missing Permissions' error");
        else console.error(e);
        return false;
    }
}

const fetchAlerts = async (interaction) => {
    const auth = await authUser(interaction.user.id);
    if(!auth.success) return authFailureMessage(interaction, auth, s(interaction).error.AUTH_ERROR_ALERTS);

    const channel = interaction.channel || await fetchChannel(interaction.channelId);
    const emojiString = await VPEmoji(interaction, channel);

    return await alertsPageEmbed(interaction, await filteredAlertsForUser(interaction), 0, emojiString);
}

// ** Authmanager **
let failedOperations = [];

const waitForAuthQueueResponse = async (queueResponse, pollRate=300) => {
    if(!queueResponse.inQueue) return queueResponse;
    while(true) {
        let response = await getAuthQueueItemStatus(queueResponse.c);
        if(response.processed) return response.result;
        await wait(pollRate);
    }
}

const activeWaitForAuthQueueResponse = async (interaction, queueResponse, pollRate=client.config.VALORANT.loginQueuePollRate) => {
    // like the above, but edits the interaction to keep the user updated
    let replied = false;
    while(true) {
        let response = await getAuthQueueItemStatus(queueResponse.c);
        if(response.processed) return response.result;

        let embed;
        if(response.timestamp) embed = secondaryEmbed(s(interaction).error.QUEUE_WAIT.f({t: response.timestamp }));
        else embed = secondaryEmbed("Processing...");
        if(replied) await interaction.editReply({embeds: [embed]});
        else {
            await interaction.followUp({embeds: [embed]});
            replied = true;
        }

        await wait(pollRate);
    }
}

const loginUsernamePassword = async (interaction, username, password, operationIndex=null) => {
    let login = await queueUsernamePasswordLogin(interaction.user.id, username, password);
    if(login.inQueue) login = await activeWaitForAuthQueueResponse(interaction, login);

    const user = getUser(interaction.user.id);
    if(login.success && user) {
        client.logger.debug(`${interaction.user.tag} logged in as ${user.username}`);
        await interaction.editReply({
            embeds: [basicEmbed(s(interaction).info.LOGGED_IN.f({u: user.username}, interaction, false))],
            ephemeral: true
        });

        if(operationIndex !== null) {
            const index = failedOperations.findIndex(o => o.index === operationIndex);
            if(index > -1) failedOperations.splice(operationIndex, 1);
        }
    } else if(login.error) {
        client.logger.error(`${interaction.user.tag} login error`);
        console.error(login.error);
        const index = operationIndex || generateOperationIndex();
        failedOperations.push({
            c: index,
            operation: Operations.USERNAME_PASSWORD,
            id: interaction.user.id,
            timestamp: Date.now(),
            username, password
        });

        await interaction.editReply({
            embeds: [basicEmbed(s(interaction).error.GENERIC_ERROR.f({e: login.error.message}))],
            components: [actionRow(retryAuthButton(interaction.user.id, index, s(interaction).info.AUTH_ERROR_RETRY))]
        });
    } else {
        client.logger.error(`${interaction.user.tag} login error`);
        await interaction.editReply(authFailureMessage(interaction, login, s(interaction).error.INVALID_PASSWORD, true));
    }
}

const login2FA = async (interaction, code, operationIndex=null) => {
    let login = await queue2FACodeRedeem(interaction.user.id, code);
    if(login.inQueue) login = await waitForAuthQueueResponse(login);

    const user = getUser(interaction.user.id);
    if(login.success && user) {
        client.logger.debug(`${interaction.user.tag} logged in as ${user.username} with 2FA code`);
        await interaction.followUp({
            embeds: [basicEmbed(s(interaction).info.LOGGED_IN.f({u: user.username}, interaction, false))]
        });
    } else if(login.error) {
        console.error(`${interaction.user.tag} 2FA error`);
        console.error(login.error);
        const index = operationIndex || generateOperationIndex();
        failedOperations.push({
            c: index,
            operation: Operations.MFA,
            id: interaction.user.id,
            timestamp: Date.now(),
            code
        });

        await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.GENERIC_ERROR.f({e: login.error.message}))],
            components: [actionRow(retryAuthButton(interaction.user.id, index, s(interaction).info.AUTH_ERROR_RETRY))]
        });
    } else {
        console.log(`${interaction.user.tag} 2FA code failed`);
        await interaction.followUp(authFailureMessage(interaction, login, s(interaction).error.INVALID_2FA, true));
    }
}

const retryFailedOperation = async (interaction, index) => {
    const operation = failedOperations.find(o => o.c === index);
    if(!operation) return await interaction.followUp({
        embeds: [basicEmbed(s(interaction).error.AUTH_ERROR_RETRY_EXPIRED)],
        ephemeral: true
    });

    switch(operation.operation) {
        case Operations.USERNAME_PASSWORD:
            await loginUsernamePassword(interaction, operation.username, operation.password, operation.c);
            break;
        case Operations.MFA:
            await login2FA(interaction, operation.code, operation.c);
            break;
    }
}

const cleanupFailedOperations = () => {
    failedOperations = failedOperations.filter(o => Date.now() - o.timestamp < client.config.VALORANT.loginRetryTimeout);
}

const generateOperationIndex = () => {
    let index = Math.floor(Math.random() * 100000);
    while(failedOperations.find(o => o.c === index)) index = Math.floor(Math.random() * 100000);
    return index;
}

const VAL_COLOR_1 = 0xFD4553;
const VAL_COLOR_2 = 0x202225;
const VAL_COLOR_3 = 0xEAEEB2;

const thumbnails = [
    "https://media.valorant-api.com/sprays/290565e7-4540-5764-31da-758846dc2a5a/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/31ba7f82-4fcb-4cbb-a719-06a3beef8603/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/fef66645-4e35-ff38-1b7c-799dd5fc7468/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/02f4c1db-46bb-a572-e830-0886edbb0981/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/40222bb5-4fce-9320-f4f1-95861df83c47/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/a7e1a9b6-4ab5-e6f7-e5fe-bc86f87b44ee/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/09786b0a-4c3e-5ba8-46ab-c49255620a5f/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/7b0e0c8d-4f91-2a76-19b9-079def2fa843/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/ea087a08-4b9f-bd0d-15a5-d3ba09c4c381/fulltransparenticon.png",
    "https://media.valorant-api.com/sprays/40ff9251-4c11-b729-1f27-088ee032e7ce/fulltransparenticon.png"
];

const authFailureMessage = (interactionOrId, authResponse, message="AUTH_ERROR", isEphemeral=false) => {
    const id = interactionOrId?.user?.id || interactionOrId;
    const tag = interactionOrId?.user?.tag || id;
    let embed;

    if(authResponse.maintenance) embed = basicEmbed(s(interactionOrId).error.MAINTENANCE);
    else if(authResponse.mfa) {
        console.log(`${tag} needs 2FA code`);
        if(authResponse.method === "email") {
            if(isEphemeral) embed = basicEmbed(s(interactionOrId).info.MFA_EMAIL.f({e: escapeMarkdown(authResponse.email)}));
            else embed = basicEmbed(s(interactionOrId).info.MFA_EMAIL_HIDDEN);
        }
        else embed = basicEmbed(s(interactionOrId).info.MFA_GENERIC);
    }
    else if(authResponse.rateLimit) {
        console.log(`${tag} got rate-limited`);
        if(typeof authResponse.rateLimit === "number") embed = basicEmbed(s(interactionOrId).error.LOGIN_RATELIMIT_UNTIL.f({t: Math.ceil(authResponse.rateLimit / 1000)}));
        else embed = basicEmbed(s(interactionOrId).error.LOGIN_RATELIMIT);
    }
    else {
        embed = basicEmbed(message);

        // two-strike system
        const user = getUser(id);
        if(user) {
            user.authFailures++;
            saveUser(user);
        }
    }

    return {
        embeds: [embed],
        ephemeral: true
    }
}

const skinChosenEmbed = async (interaction, skin) => {
    const channel = interaction.channel || await fetchChannel(interaction.channelId);
    let description = s(interaction).info.ALERT_SET.f({s: await skinNameAndEmoji(skin, channel, interaction)});
    if(client.config.VALORANT.fetchSkinPrices && !skin.price) description += s(interaction).info.ALERT_BP_SKIN;
    return {
        description: description,
        color: VAL_COLOR_1,
        thumbnail: {
            url: skin.icon
        }
    }
}

const renderOffers = async (shop, interaction, valorantUser, VPemoji, otherId=null) => {
    const forOtherUser = otherId && otherId !== interaction.user.id;
    const otherUserMention = `<@${otherId}>`;

    if(!shop.success) {
        let errorText;

        if(forOtherUser) errorText = s(interaction).error.AUTH_ERROR_SHOP_OTHER.f({u: otherUserMention});
        else errorText = s(interaction).error.AUTH_ERROR_SHOP;

        return authFailureMessage(interaction, shop, errorText);
    }

    let headerText;
    if(forOtherUser) {
        const json = readUserJson(otherId);

        let usernameText = otherUserMention;
        if(json.accounts.length > 1) usernameText += ' ' + s(interaction).info.SWITCH_ACCOUNT_BUTTON.f({n: json.currentAccount});

        headerText = s(interaction).info.SHOP_HEADER.f({u: usernameText, t: shop.expires});
    }
    else headerText = s(interaction).info.SHOP_HEADER.f({u: valorantUser.username, t: shop.expires}, interaction);

    const embeds = [headerEmbed(headerText)];

    for(const uuid of shop.offers) {
        const skin = await getSkin(uuid);
        const price = isDefaultSkin(skin) ? "0" : skin.price; // force render price for defaults
        const embed = await skinEmbed(skin.uuid, price, interaction, VPemoji);
        embeds.push(embed);
    }

    // show notice if there is one
    if(client.config.VALORANT.notice && valorantUser) {
        // users shouldn't see the same notice twice
        if(!client.config.VALORANT.onlyShowNoticeOnce || valorantUser.lastNoticeSeen !== client.config.VALORANT.notice) {

            // the notice can either be just a simple string, or a raw JSON embed data object
            if(typeof client.config.VALORANT.notice === "string") {
                if(client.config.VALORANT.notice.startsWith('{')) embeds.push(EmbedBuilder.from(JSON.parse(client.config.VALORANT.notice)).toJSON());
                else embeds.push(basicEmbed(client.config.VALORANT.notice));
            }
            else embeds.push(EmbedBuilder.from(client.config.VALORANT.notice).toJSON());

            valorantUser.lastNoticeSeen = client.config.VALORANT.notice;
            saveUser(valorantUser);
        }
    }
    let components;
    if(forOtherUser){
        components = null;
    } else {
        components = switchAccountButtons(interaction, "shop", true, "daily");
    }
    const levels = await getSkinLevels(shop.offers, interaction);
    if(levels) components === null ? components = [levels] : components.unshift(levels)
    return {
        embeds, components
    };
}

const renderAccessoryOffers = async (shop, interaction, valorantUser, KCemoji) => {
    if(!shop.success) {
        let errorText = s(interaction).error.AUTH_ERROR_SHOP;

        return authFailureMessage(interaction, shop, errorText);
    }

    let headerText = s(interaction).info.ACCESSORY_SHOP_HEADER.f({ u: valorantUser.username, t: shop.accessory.expires }, interaction);

    const embeds = [headerEmbed(headerText)];
    for (const offer of shop.accessory.offers) {
        for (const reward of offer.rewards){
            
            switch (reward.ItemTypeID) {
                case "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475": //sprays
                    embeds.push(await sprayEmbed(reward.ItemID, offer.cost, interaction, KCemoji))
                    break;
                case "dd3bf334-87f3-40bd-b043-682a57a8dc3a": //gun buddies
                    embeds.push(await buddyEmbed(reward.ItemID, offer.cost, interaction, KCemoji))
                    break;
                case "3f296c07-64c3-494c-923b-fe692a4fa1bd": //cards
                    embeds.push(await cardEmbed(reward.ItemID, offer.cost, interaction, KCemoji))
                    break;
                case "de7caa6b-adf7-4588-bbd1-143831e786c6": //titles
                    embeds.push(await titleEmbed(reward.ItemID, offer.cost, interaction, KCemoji))
                    break;
                default:
                    console.log(reward.ItemTypeID);
            }
        }
    }

    // leave a little message if the accessory shop is empty (i.e. they have every single accessory in the game)
    if(shop.accessory.offers.length === 0) {
        embeds.push(basicEmbed(s(interaction).info.NO_MORE_ACCESSORIES));
    }

    // show notice if there is one
    if(client.config.VALORANT.notice && valorantUser) {
        // users shouldn't see the same notice twice
        if(!client.config.VALORANT.onlyShowNoticeOnce || valorantUser.lastNoticeSeen !== client.config.VALORANT.notice) {

            // the notice can either be just a simple string, or a raw JSON embed data object
            if(typeof client.config.VALORANT.notice === "string") {
                if(client.config.VALORANT.notice.startsWith('{')) embeds.push(EmbedBuilder.from(JSON.parse(client.config.VALORANT.notice)).toJSON());
                else embeds.push(basicEmbed(client.config.VALORANT.notice));
            }
            else embeds.push(EmbedBuilder.from(client.config.VALORANT.notice).toJSON());

            valorantUser.lastNoticeSeen = client.config.VALORANT.notice;
            saveUser(valorantUser);
        }
    }

    let components = switchAccountButtons(interaction, "accessoryshop", true, "accessory");

    return {
        embeds, components
    };
}

const getSkinLevels = async (offers, interaction, nightmarket = false) => {
    const skinSelector = new StringSelectMenuBuilder()
        .setCustomId("select-skin-with-level")
        .setPlaceholder(s(interaction).info.SELECT_SKIN_WITH_LEVEL)
    
    for (const uuid of offers) {
        let skin = await getSkin(nightmarket ? uuid.uuid : uuid);
        if(!skin) continue;

        for (let i = 0; i < skin.levels.length; i++) {
            const level = skin.levels[i];
            if(level.streamedVideo){
                skinSelector.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${l(skin.names, interaction)}`)
                        .setValue(`${skin.uuid}`)
                )
                break;
            }
        }
    }

    if(skinSelector.options.length===0) return false;
    return new ActionRowBuilder().addComponents(skinSelector);
}

const renderBundles = async (bundles, interaction, VPemoji) => {
    if(!bundles.success) return authFailureMessage(interaction, bundles, s(interaction).error.AUTH_ERROR_BUNDLES);

    bundles = bundles.bundles;

    if(bundles.length === 1) {
        const bundle = await getBundle(bundles[0].uuid);

        const renderedBundle = await renderBundle(bundle, interaction, VPemoji, false);
        const titleEmbed = renderedBundle.embeds[0];
        titleEmbed.title = s(interaction).info.BUNDLE_HEADER.f({b: titleEmbed.title});
        titleEmbed.description += ` *(${s(interaction).info.EXPIRES.f({t: bundle.expires})})*`;

        return renderedBundle;
    }

    const embeds = [{
        title: s(interaction).info.BUNDLES_HEADER,
        description: s(interaction).info.BUNDLES_HEADER_DESC,
        color: VAL_COLOR_1
    }];

    const buttons = [];

    for(const bundleData of bundles) {
        const bundle = await getBundle(bundleData.uuid);

        const subName = bundle.subNames ? l(bundle.subNames, interaction) + "\n" : "";
        const slantedDescription = bundle.descriptions ? "*" + l(bundle.descriptions, interaction) + "*\n" : "";
        const embed = {
            title: s(interaction).info.BUNDLE_NAME.f({b: l(bundle.names, interaction)}),
            description: `${subName}${slantedDescription}${VPemoji} **${bundle.price || s(interaction).info.FREE}** - ${s(interaction).info.EXPIRES.f({t:bundle.expires})}`,
            color: VAL_COLOR_2,
            thumbnail: {
                url: bundle.icon
            }
        };
        embeds.push(embed);

        if(buttons.length < 5) {
            buttons.push(new ButtonBuilder().setCustomId(`viewbundle/${interaction.user.id}/${bundle.uuid}`).setStyle(ButtonStyle.Primary).setLabel(l(bundle.names, interaction)).setEmoji("🔎"));
        }
    }

    return {
        embeds: embeds,
        components: [new ActionRowBuilder().addComponents(...buttons)]
    };
}

const renderBundle = async (bundle, interaction, emoji, includeExpires=true) => {
    const subName = bundle.subNames ? l(bundle.subNames, interaction) + "\n" : "";
    const slantedDescription = bundle.descriptions ? "*" + l(bundle.descriptions, interaction) + "*\n" : "";
    const strikedBundleBasePrice = bundle.basePrice ? " ~~" + bundle.basePrice + "~~" : "";
    const UnixStamp = bundle.last_seen / 1000 ? `\n_${s(interaction).info.BUNDLE_RELEASED.f({t: bundle.last_seen / 1000})}_\n` : "";

    if(!bundle.items) return {embeds: [{
        title: s(interaction).info.BUNDLE_NAME.f({b: l(bundle.names, interaction)}),
        description: `${subName}${slantedDescription}`,
        color: VAL_COLOR_1,
        image: {
            url: bundle.icon
        },
        footer: {
            text: s(interaction).info.NO_BUNDLE_DATA
        }
    }]};

    const bundleTitleEmbed = {
        title: s(interaction).info.BUNDLE_NAME.f({b: l(bundle.names, interaction)}),
        description: `${subName}${slantedDescription}${UnixStamp}${emoji} **${bundle.price}**${strikedBundleBasePrice}`,
        color: VAL_COLOR_3,
        image: {
            url: bundle.icon
        }
    }

    if(includeExpires && bundle.expires) bundleTitleEmbed.description += ` (${(bundle.expires > Date.now() / 1000 ? 
        s(interaction).info.EXPIRES : s(interaction).info.EXPIRED).f({t: bundle.expires})})`;

    const itemEmbeds = await renderBundleItems(bundle, interaction, emoji);
    const levels = await getSkinLevels(bundle.items.map(i=>i.uuid), interaction);
    return levels ? {embeds: [bundleTitleEmbed, ...itemEmbeds], components: [levels]} : {embeds: [bundleTitleEmbed, ...itemEmbeds], components: []};
}

const renderNightMarket = async (market, interaction, valorantUser, emoji) => {
    if(!market.success) return authFailureMessage(interaction, market, s(interaction).error.AUTH_ERROR_NMARKET);

    if(!market.offers) {
        const nextNightMarketTimestamp = await getNextNightMarketTimestamp();
        const text = nextNightMarketTimestamp ? s(interaction).error.NO_NMARKET_WITH_DATE.f({t: nextNightMarketTimestamp}) : s(interaction).error.NO_NMARKET;
        return {embeds: [basicEmbed(text)]};
    }

    const embeds = [{
        description: s(interaction).info.NMARKET_HEADER.f({u: valorantUser.username, t: market.expires}, interaction),
        color: VAL_COLOR_3
    }];

    for(const offer of market.offers) {
        const skin = await getSkin(offer.uuid);

        const embed = await skinEmbed(skin.uuid, skin.price, interaction, emoji);
        embed.description = `${emoji} **${offer.nmPrice}**\n${emoji} ~~${offer.realPrice}~~ (-${offer.percent}%)`;

        embeds.push(embed);
    }
    
    const components = switchAccountButtons(interaction, "nm", true);

    const levels = await getSkinLevels(market.offers, interaction, true);
    if(levels) components.unshift(levels);
    return {
        embeds, components
    };
}

const renderBattlepass = async (battlepass, targetlevel, interaction) => {
    if(!battlepass.success) return authFailureMessage(interaction, battlepass, s(interaction).error.AUTH_ERROR_BPASS);
    if(battlepass.nextReward.rewardType === "EquippableCharmLevel"){
        battlepass.nextReward.rewardType = s(interaction).battlepass.GUN_BUDDY;
    }
    if(battlepass.nextReward.rewardType === "EquippableSkinLevel"){
        battlepass.nextReward.rewardType = s(interaction).battlepass.SKIN;
    }
    if(battlepass.nextReward.rewardType === "PlayerCard"){
        battlepass.nextReward.rewardType = s(interaction).battlepass.CARD;
    }
    if(battlepass.nextReward.rewardType === "Currency") {
        battlepass.nextReward.rewardType = s(interaction).battlepass.CURRENCY;
    }
    if(battlepass.nextReward.rewardType === "Spray") {
        battlepass.nextReward.rewardType = s(interaction).battlepass.SPRAY;
    }
    if(battlepass.nextReward.rewardName === undefined) {
        battlepass.nextReward.rewardName = "Name not found"
    }
    const user = getUser(interaction.user.id);

    let embeds = []
    if(battlepass.bpdata.progressionLevelReached < 55) {
        embeds.push({
            title: s(interaction).battlepass.CALCULATIONS_TITLE,
            thumbnail: {url: thumbnails[Math.floor(Math.random()*thumbnails.length)]},
            description: `${s(interaction).battlepass.TIER_HEADER.f({u: user.username}, interaction)}\n${createProgressBar(battlepass.xpneeded, battlepass.bpdata.progressionTowardsNextLevel, battlepass.bpdata.progressionLevelReached)}`,
            color: VAL_COLOR_1,
            fields: [
                {
                    "name": s(interaction).battlepass.GENERAL_COL,
                    "value": `${s(interaction).battlepass.TOTAL_ROW}\n${s(interaction).battlepass.LVLUP_ROW}\n${s(interaction).battlepass.TIER50_ROW.f({t: targetlevel})}\n${s(interaction).battlepass.WEEKLY_LEFT_ROW}`,
                    "inline": true
                },
                {
                    "name": s(interaction).battlepass.XP_COL,
                    "value": `\`${battlepass.totalxp}\`\n\`${battlepass.xpneeded}\`\n\`${battlepass.totalxpneeded}\`\n\`${battlepass.weeklyxp}\``,
                    "inline": true
                }
            ],
            footer: {
                text: battlepass.battlepassPurchased ? s(interaction).battlepass.BP_PURCHASED.f({u: user.username}, interaction) : ""
            }
        },
        {
            title: s(interaction).battlepass.GAMES_HEADER,
            color: VAL_COLOR_1,
            fields: [
                {
                    "name": s(interaction).battlepass.GAMEMODE_COL,
                    "value": `${s(interaction).battlepass.SPIKERUSH_ROW}\n${s(interaction).battlepass.NORMAL_ROW}\n`,
                    "inline": true
                },
                {
                    "name": "#",
                    "value": `\`${battlepass.spikerushneeded}\`\n\`${battlepass.normalneeded}\``,
                    "inline": true
                },
                {
                    "name": s(interaction).battlepass.INCL_WEEKLIES_COL,
                    "value": `\`${battlepass.spikerushneededwithweeklies}\`\n\`${battlepass.normalneededwithweeklies}\``,
                    "inline": true
                }
            ],
            footer: {
                text: s(interaction).battlepass.ACT_END.f({d: battlepass.season_days_left})
            }
        },
        {
            title: s(interaction).battlepass.XP_HEADER,
            color: VAL_COLOR_1,
            fields: [
                {
                    "name": s(interaction).battlepass.AVERAGE_COL,
                    "value": `${s(interaction).battlepass.DAILY_XP_ROW}\n${s(interaction).battlepass.WEEKLY_XP_ROW}`,
                    "inline": true
                },
                {
                    "name": s(interaction).battlepass.XP_COL,
                    "value": `\`${battlepass.dailyxpneeded}\`\n\`${battlepass.weeklyxpneeded}\``,
                    "inline": true
                },
                {
                    "name": s(interaction).battlepass.INCL_WEEKLIES_COL,
                    "value": `\`${battlepass.dailyxpneededwithweeklies}\`\n\`${battlepass.weeklyxpneededwithweeklies}\``,
                    "inline": true
                }
            ]
        },
        {
            title: s(interaction).battlepass.NEXT_BP_REWARD,
            color: VAL_COLOR_1,
            fields: [
                {
                    "name": `**${s(interaction).battlepass.TYPE}:** \`${battlepass.nextReward.rewardType}\``,
                    "value": `**${s(interaction).battlepass.REWARD}:** ${battlepass.nextReward.rewardName}\n**XP:** ${battlepass.bpdata.progressionTowardsNextLevel}/${battlepass.nextReward.XP}`,
                    "inline": true
                },
            ],
            thumbnail: {
              url: battlepass.nextReward.rewardIcon,
            },
        });
    } else {
        embeds.push({
            description: s(interaction).battlepass.FINISHED,
            color: VAL_COLOR_1,
        })
    }

    const components = switchAccountButtons(interaction, "bp");

    return {embeds, components};
}

const renderBundleItems = async (bundle, interaction, VPemojiString) => {
    if(!bundle.items) return [];

    const priorities = {};
    priorities[itemTypes.SKIN] = 5;
    priorities[itemTypes.BUDDY] = 4;
    priorities[itemTypes.SPRAY] = 3;
    priorities[itemTypes.CARD] = 2;
    priorities[itemTypes.TITLE] = 1;

    const items = bundle.items.sort((a, b) => priorities[b.type] - priorities[a.type]);

    const embeds = [];
    for(const item of items) {
        const embed = await bundleItemEmbed(item, interaction, VPemojiString);

        if(item.amount !== 1) embed.title = `${item.amount}x ${embed.title}`;
        if(item.basePrice && item.price !== item.basePrice) {
            embed.description = `${VPemojiString} **${item.price || s(interaction).info.FREE}** ~~${item.basePrice}~~`;
            if(item.type === itemTypes.TITLE && item.item) embed.description = "`" + item.item.text + "`\n\n" + embed.description
        }

        embeds.push(embed);
    }

    // discord has a limit of 10 embeds (9 if we count the bundle title)
    if(embeds.length > 9) {
        embeds.length = 8;
        embeds.push(basicEmbed(s(interaction).info.MORE_ITEMS.f({n: items.length - 8})));
    }

    return embeds;
}

const bundleItemEmbed = async (item, interaction, VPemojiString) => {
    switch(item.type) {
        case itemTypes.SKIN: return skinEmbed(item.uuid, item.price, interaction, VPemojiString);
        case itemTypes.BUDDY: return buddyEmbed(item.uuid, item.price, interaction, VPemojiString);
        case itemTypes.CARD: return cardEmbed(item.uuid, item.price, interaction, VPemojiString);
        case itemTypes.SPRAY: return sprayEmbed(item.uuid, item.price, interaction, VPemojiString);
        case itemTypes.TITLE: return titleEmbed(item.uuid, item.price, interaction, VPemojiString);
        default: return basicEmbed(s(interaction).error.UNKNOWN_ITEM_TYPE.f({t: item.type}));
    }
}

const skinEmbed = async (uuid, price, interaction, VPemojiString) => {
    const skin = await getSkin(uuid);
    const colorMap = {
      '0cebb8be-46d7-c12a-d306-e9907bfc5a25': 0x009984,
      'e046854e-406c-37f4-6607-19a9ba8426fc': 0xf99358,
      '60bca009-4182-7998-dee7-b8a2558dc369': 0xd1538c,
      '12683d76-48d7-84a3-4e09-6985794f0445': 0x5a9fe1,
      '411e4a55-4e59-7757-41f0-86a53f101bb5': 0xf9d563
    };

    const color = colorMap[skin.rarity] || '000000'; // default to black
    return {
        title: await skinNameAndEmoji(skin, interaction.channel, interaction),
        url: client.config.VALORANT.linkItemImage ? skin.icon : null,
        description: priceDescription(VPemojiString, price),
        color: color,
        thumbnail: {
            url: skin.icon
        }
    };
}

const buddyEmbed = async (uuid, price, locale, emojiString) => {
    const buddy = await getBuddy(uuid);
    return {
        title: l(buddy.names, locale),
        url: client.config.VALORANT.linkItemImage ? buddy.icon : null,
        description: priceDescription(emojiString, price),
        color: VAL_COLOR_2,
        thumbnail: {
            url: buddy.icon
        }
    }
}

const cardEmbed = async (uuid, price, locale, emojiString) => {
    const card = await getCard(uuid);
    return {
        title: l(card.names, locale),
        url: client.config.VALORANT.linkItemImage ? card.icons.large : null,
        description: priceDescription(emojiString, price),
        color: VAL_COLOR_2,
        thumbnail: {
            url: card.icons.large
        }
    }
}

const sprayEmbed = async (uuid, price, locale, emojiString) => {
    const spray = await getSpray(uuid);
    return {
        title: l(spray.names, locale),
        url: client.config.VALORANT.linkItemImage ? spray.icon : null,
        description: priceDescription(emojiString, price),
        color: VAL_COLOR_2,
        thumbnail: {
            url: spray.icon
        }
    }
}

const titleEmbed = async (uuid, price, locale, emojiString) => {
    const title = await getTitle(uuid);
    return {
        title: l(title.names, locale),
        description: "`" + l(title.text, locale) + "`\n\n" + (priceDescription(emojiString, price) || ""),
        color: VAL_COLOR_2,
    }
}

const skinCollectionSingleEmbed = async (interaction, id, user, {loadout, favorites}) => {
    const someoneElseUsedCommand = interaction.message ?
        interaction.message.interaction && interaction.message.interaction.user.id !== user.id :
        interaction.user.id !== user.id;

    let totalValue = 0;
    const skinsUuid = [];
    const createField = async (weaponUuid, inline=true) => {
        const weapon = await getWeapon(weaponUuid);
        const skin = await getSkinFromSkinUuid(loadout.Guns.find(gun => gun.ID === weaponUuid).SkinID);
        skinsUuid.push(skin);
        totalValue += skin.price;

        const starEmoji = favorites.FavoritedContent[skin.skinUuid] ? "⭐ " : "";
        return {
            name: l(weapon.names, interaction),
            value: `${starEmoji}${await skinNameAndEmoji(skin, interaction.channel, interaction)}`,
            inline: inline
        }
    }

    const emptyField = {
        name: "\u200b",
        value: "\u200b",
        inline: true
    }

    const fields = [
        await createField(WeaponTypeUuid.Vandal),
        await createField(WeaponTypeUuid.Phantom),
        await createField(WeaponTypeUuid.Operator),

        await createField(WeaponTypeUuid.Knife),
        await createField(WeaponTypeUuid.Sheriff),
        await createField(WeaponTypeUuid.Spectre),

        await createField(WeaponTypeUuid.Classic),
        await createField(WeaponTypeUuid.Ghost),
        await createField(WeaponTypeUuid.Frenzy),

        await createField(WeaponTypeUuid.Bulldog),
        await createField(WeaponTypeUuid.Guardian),
        await createField(WeaponTypeUuid.Marshal),

        await createField(WeaponTypeUuid.Stinger),
        await createField(WeaponTypeUuid.Ares),
        await createField(WeaponTypeUuid.Odin),

        await createField(WeaponTypeUuid.Shorty),
        await createField(WeaponTypeUuid.Bucky),
        await createField(WeaponTypeUuid.Judge),
    ]

    const emoji = await VPEmoji(interaction);
    fields.push(emptyField, {
        name: s(interaction).info.COLLECTION_VALUE,
        value: `${emoji} ${totalValue}`,
        inline: true
    }, emptyField);

    let usernameText;
    if(someoneElseUsedCommand) {
        usernameText = `<@${id}>`;

        const json = readUserJson(id);
        if(json.accounts.length > 1) usernameText += ' ' + s(interaction).info.SWITCH_ACCOUNT_BUTTON.f({n: json.currentAccount});
    }
    else usernameText = user.username;


    const embed = {
        description: s(interaction).info.COLLECTION_HEADER.f({u: usernameText}, id),
        color: VAL_COLOR_1,
        fields: fields
    }

    const components = [new ActionRowBuilder().addComponents(collectionSwitchEmbedButton(interaction, true, id)),]
    if(!someoneElseUsedCommand) components.push(...switchAccountButtons(interaction, "cl", false, id))
    
    const levels = await getSkinLevels(skinsUuid.map(item=>item.uuid), interaction);
    if(levels) components.unshift(levels);

    return {
        embeds: [embed],
        components: components
    }
}

const skinCollectionPageEmbed = async (interaction, id, user, {loadout, favorites}, pageIndex=0) => {
    const someoneElseUsedCommand = interaction.message ?
        interaction.message.interaction && interaction.message.interaction.user.id !== user.id :
        interaction.user.id !== user.id;

    let totalValue = 0;
    const emoji = await VPEmoji(interaction);


    const createEmbed = async (weaponUuid) => {
        const weapon = await getWeapon(weaponUuid);
        const skin = await getSkinFromSkinUuid(loadout.Guns.find(gun => gun.ID === weaponUuid).SkinID);

        totalValue += skin.price;

        const starEmoji = favorites.FavoritedContent[skin.skinUuid] ? " ⭐" : "";
        return {
            title: l(weapon.names, interaction),
            description: `**${await skinNameAndEmoji(skin, interaction.channel, interaction)}**${starEmoji}\n${emoji} ${skin.price || 'N/A'}`,
            color: VAL_COLOR_2,
            thumbnail: {
                url: skin.icon
            }
        }
    }

    const pages = [
        [WeaponTypeUuid.Vandal, WeaponTypeUuid.Phantom, WeaponTypeUuid.Operator, WeaponTypeUuid.Knife],
        [WeaponTypeUuid.Classic, WeaponTypeUuid.Sheriff, WeaponTypeUuid.Spectre, WeaponTypeUuid.Marshal],
        [WeaponTypeUuid.Frenzy, WeaponTypeUuid.Ghost, WeaponTypeUuid.Bulldog, WeaponTypeUuid.Guardian],
        [WeaponTypeUuid.Shorty, WeaponTypeUuid.Bucky, WeaponTypeUuid.Judge],
        [WeaponTypeUuid.Stinger, WeaponTypeUuid.Ares, WeaponTypeUuid.Odin],
    ];

    if(pageIndex < 0) pageIndex = pages.length - 1;
    if(pageIndex >= pages.length) pageIndex = 0;

    let usernameText;
    if(someoneElseUsedCommand) {
        usernameText = `<@${id}>`;

        const json = readUserJson(id);
        if(json.accounts.length > 1) usernameText += ' ' + s(interaction).info.SWITCH_ACCOUNT_BUTTON.f({n: json.currentAccount});
    }
    else usernameText = user.username;

    const embeds = [basicEmbed(s(interaction).info.COLLECTION_HEADER.f({u: usernameText}, id))];
    for(const weapon of pages[pageIndex]) {
        embeds.push(await createEmbed(weapon));
    }

    const firstRowButtons = [collectionSwitchEmbedButton(interaction, false, id)];
    firstRowButtons.push(...(pageButtons("clpage", id, pageIndex, pages.length).components))

    const components = [new ActionRowBuilder().setComponents(...firstRowButtons)]
    if(!someoneElseUsedCommand) components.push(...switchAccountButtons(interaction, "cl", false, id));

    return {embeds, components}
}

const collectionSwitchEmbedButton = (interaction, switchToPage, id) => {
    const label = s(interaction).info[switchToPage ? "COLLECTION_VIEW_IMAGES" : "COLLECTION_VIEW_ALL"];
    const customId = `clswitch/${switchToPage ? "p" : "s"}/${id}`;
    return new ButtonBuilder().setEmoji('🔍').setLabel(label).setStyle(ButtonStyle.Primary).setCustomId(customId);
}

const collectionOfWeaponEmbed = async (interaction, id, user, weaponTypeUuid, skins, pageIndex=0) => {
    const someoneElseUsedCommand = interaction.message ?
        interaction.message.interaction && interaction.message.interaction.user.id !== user.id :
        interaction.user.id !== user.id;

    const emoji = await VPEmoji(interaction);

    let usernameText;
    if(someoneElseUsedCommand) {
        usernameText = `<@${id}>`;

        const json = readUserJson(id);
        if(json.accounts.length > 1) usernameText += ' ' + s(interaction).info.SWITCH_ACCOUNT_BUTTON.f({n: json.currentAccount});
    }
    else usernameText = user.username;

    // note: some of these are null for some reason
    const skinsData = await Promise.all(skins.map(skinUuid => getSkin(skinUuid, false)));
    const filteredSkins = skinsData.filter(skin => skin?.weapon === weaponTypeUuid);
    filteredSkins.sort((a, b) => { // sort by price, then rarity
        const priceDiff = (b.price || 0) - (a.price || 0);
        if(priceDiff !== 0) return priceDiff;

        const rarityOrder = [
            "12683d76-48d7-84a3-4e09-6985794f0445", // select
            "0cebb8be-46d7-c12a-d306-e9907bfc5a25", // deluxe
            "60bca009-4182-7998-dee7-b8a2558dc369", // premium
            "411e4a55-4e59-7757-41f0-86a53f101bb5", // ultra
            "e046854e-406c-37f4-6607-19a9ba8426fc", // exclusive
        ];
        return rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
    });

    const embedsPerPage = 5;
    const maxPages = Math.ceil(filteredSkins.length / embedsPerPage);

    if(pageIndex < 0) pageIndex = maxPages - 1;
    if(pageIndex >= maxPages) pageIndex = 0;

    const weaponName = await getWeapon(weaponTypeUuid).then(weapon => l(weapon.names, interaction));
    const embeds = [basicEmbed(s(interaction).info.COLLECTION_WEAPON_HEADER.f({u: usernameText, w: weaponName, p: pageIndex + 1, t: maxPages}, id))];
    const skinEmbed = async (skin) => ({
        title: await skinNameAndEmoji(skin, interaction.channel, interaction),
        description: `${emoji} ${skin.price || 'N/A'}`,
        color: VAL_COLOR_2,
        thumbnail: {
            url: skin.icon
        }
    })
    if(filteredSkins.length === 0) {
        const weapon = await getWeapon(weaponTypeUuid);
        const skin = await getSkinFromSkinUuid(weapon.defaultSkinUuid);
        embeds.push(await skinEmbed(skin));
    }
    else for(const skin of filteredSkins.slice(pageIndex * embedsPerPage, (pageIndex + 1) * embedsPerPage)) {
        embeds.push(await skinEmbed(skin));
    }

    const weaponTypeIndex = Object.values(WeaponTypeUuid).indexOf(weaponTypeUuid);

    const actionRows = [];
    if(maxPages > 1) actionRows.push(pageButtons(`clwpage/${weaponTypeIndex}`, id, pageIndex, maxPages));
    if(!someoneElseUsedCommand) actionRows.push(...switchAccountButtons(interaction, `clw-${weaponTypeIndex}`, false, id));

    const levels = await getSkinLevels(filteredSkins.slice(pageIndex * embedsPerPage, (pageIndex + 1) * embedsPerPage).map(item=>item.uuid), interaction);
    if(levels) actionRows.unshift(levels);

    return {embeds, components: actionRows}
}

const botInfoEmbed = (interaction, client, guildCount, userCount, registeredUserCount, ownerString, status) => {
    const fields = [
        {
            name: s(interaction).info.INFO_SERVERS,
            value: guildCount.toString(),
            inline: true
        },
        {
            name: s(interaction).info.INFO_MEMBERS,
            value: userCount.toString(),
            inline: true
        },
        {
            name: s(interaction).info.INFO_REGISTERED,
            value: registeredUserCount.toString(),
            inline: true
        },
        {
            name: ":dog2:",
            value: s(interaction).info.INFO_WOOF,
            inline: true
        },
        {
            name: s(interaction).info.INFO_SOURCE,
            value: "[SkinPeek](https://github.com/giorgi-o/SkinPeek) by [Giorgio](https://github.com/giorgi-o)",
            inline: true
        }
    ];
    if(ownerString) fields.push({
        name: s(interaction).info.INFO_OWNER,
        value: ownerString || "Giorgio#0609",
        inline: true
    });
    if(interaction.client.shard) fields.push({
        name: "Running on shard",
        value: interaction.client.shard.ids.join(' ') || "No shard id...?",
        inline: true
    });
    if(status) fields.push({
        name: s(interaction).info.INFO_STATUS,
        value: status || "Up and running!",
        inline: true
    });

    const readyTimestamp = Math.round(client.readyTimestamp / 1000);

    return {
        embeds: [{
            title: s(interaction).info.INFO_HEADER,
            description: s(interaction).info.INFO_RUNNING.f({t1: readyTimestamp, t2: readyTimestamp}),
            color: VAL_COLOR_1,
            fields: fields
        }]
    }
}

const ownerMessageEmbed = (messageContent, author) => {
    return {
        title: "Message from bot owner:",
        description: messageContent,
        color: VAL_COLOR_3,
        footer: {
            text: "By " + author.username,
            icon_url: author.displayAvatarURL()
        }
    }
}

const priceDescription = (VPemojiString, price) => {
    if(price) return `${VPemojiString} ${price}`;
}

const pageButtons = (pageId, userId, current, max) => {
    const leftButton = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji("◀").setCustomId(`${pageId}/${userId}/${current - 1}`);
    const rightButton = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji("▶").setCustomId(`${pageId}/${userId}/${current + 1}`);

    if(current === 0) leftButton.setEmoji("⏪");
    if(current === max - 1) rightButton.setEmoji("⏩");

    return new ActionRowBuilder().setComponents(leftButton, rightButton);
}

const switchAccountButtons = (interaction, customId, oneAccountButton=false, accessory = false, id=interaction?.user?.id || interaction) => {
    const json = removeDupeAccounts(id);
    if(!json || json.accounts.length === 1 && !oneAccountButton) return [];
    const accountNumbers = [...Array(json.accounts.length).keys()].map(n => n + 1).slice(0, client.config.VALORANT.maxAccountsPerUser <= 10 ? client.config.VALORANT.maxAccountsPerUser : 10);
    const hideIgn = getSetting(id, "hideIgn");

    const rows = []; // action rows
    const buttons = []; // account switch buttons, row 1
    const buttons2 = []; // account switch buttons, row 2

    for(const number of accountNumbers) {
        const username = json.accounts[number - 1].username || s(interaction).info.NO_USERNAME;
        const label = hideIgn ? s(interaction).info.SWITCH_ACCOUNT_BUTTON.f({n: number.toString()}) : username;

        const button = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(label).setCustomId(`account/${customId}/${id}/${number}`);
        button.setDisabled(number === json.currentAccount);

        number > 5 ? buttons2.push(button) : buttons.push(button);
    }
    // accessory/shop buttons
    // the "accessory" parameter represents the current page of the embed.
    // it can be either "daily" for the skin shop, "accessory" for the accessory shop.
    // it can also be "false" to not render this row.
    if(accessory !== false) {
        const skinShopButton = new ButtonBuilder()
                                    .setStyle(ButtonStyle.Primary)
                                    .setLabel(s(interaction).info.DAILY_SHOP_SWITCH_BUTTON)
                                    // .setLabel(test)
                                    .setEmoji("🛒")
                                    .setCustomId(`account/shop/${id}/daily`);
        const accessoryShopButton = new ButtonBuilder()
                                    .setStyle(ButtonStyle.Primary)
                                    .setLabel(s(interaction).info.ACCESSORY_SHOP_SWITCH_BUTTON)
                                    // .setLabel("AccessoryButton")
                                    .setEmoji("🎩")
                                    .setCustomId(`account/accessoryshop/${id}/accessory`);

        if(accessory === "daily") skinShopButton.setDisabled(true);
        else if(accessory === "accessory") accessoryShopButton.setDisabled(true);

        const row = new ActionRowBuilder().setComponents(skinShopButton, accessoryShopButton);
        rows.push(row);
    }
    
    rows.push(new ActionRowBuilder().setComponents(...buttons))
    if(buttons2.length) rows.push(new ActionRowBuilder().setComponents(...buttons2))
    return rows
}

const alertFieldDescription = async (interaction, channel_id, emojiString, price) => {
    if(channel_id === interaction.channelId) {
        if(price) return `${emojiString} ${price}`;
        if(client.config.VALORANT.fetchSkinPrices) return s(interaction).info.SKIN_NOT_FOR_SALE;
        return s(interaction).info.SKIN_PRICES_HIDDEN;
    } else {
        const channel = await fetchChannel(channel_id);
        if(channel && !channel.guild) return s(interaction).info.ALERT_IN_DM_CHANNEL;
        return s(interaction).info.ALERT_IN_CHANNEL.f({c: channel_id})
    }
}

const alertsPageEmbed = async (interaction, alerts, pageIndex, emojiString) => {
    const components = switchAccountButtons(interaction, "alerts");

    alerts = alerts.filter(alert => alert.uuid);

    if(alerts.length === 0) {
        return {
            embeds: [basicEmbed(s(interaction).error.NO_ALERTS)],
            components: components
        }
    }

    if(alerts.length === 1) {
        const alert = alerts[0];

        const skin = await getSkin(alert.uuid);

        return {
            embeds: [{
                title: s(interaction).info.ONE_ALERT,
                color: VAL_COLOR_1,
                description: `**${await skinNameAndEmoji(skin, interaction.channel, interaction)}**\n${await alertFieldDescription(interaction, alert.channel_id, emojiString, skin.price)}`,
                thumbnail: {
                    url: skin.icon
                }
            }],
            components: [removeAlertActionRow(interaction.user.id, alert.uuid, s(interaction).info.REMOVE_ALERT_BUTTON)].concat(components),
            ephemeral: true
        }
    }

    const maxPages = Math.ceil(alerts.length / client.config.VALORANT.alertsPerPage);

    if(pageIndex < 0) pageIndex = maxPages - 1;
    if(pageIndex >= maxPages) pageIndex = 0;

    const embed = { // todo switch this to a "one embed per alert" message, kinda like /shop
        title: s(interaction).info.MULTIPLE_ALERTS,
        color: VAL_COLOR_1,
        footer: {
            text: s(interaction).info.REMOVE_ALERTS_FOOTER
        },
        fields: []
    }
    const buttons = [];

    let n = pageIndex * client.config.VALORANT.alertsPerPage;
    const alertsToRender = alerts.slice(n, n + client.config.VALORANT.alertsPerPage);
    for(const alert of alertsToRender) {
        const skin = await getSkin(alert.uuid);
        embed.fields.push({
            name: `**${n+1}.** ${await skinNameAndEmoji(skin, interaction.channel, interaction)}`,
            value: await alertFieldDescription(interaction, alert.channel_id, emojiString, skin.price),
            inline: alerts.length > 5
        });
        buttons.push(removeAlertButton(interaction.user.id, alert.uuid, `${n+1}.`));
        n++;
    }

    const actionRows = [];
    for(let i = 0; i < alertsToRender.length; i += 5) {
        const actionRow = new ActionRowBuilder();
        for(let j = i; j < i + 5 && j < alertsToRender.length; j++) {
            actionRow.addComponents(buttons[j]);
        }
        actionRows.push(actionRow);
    }
    if(maxPages > 1) actionRows.push(pageButtons("changealertspage", interaction.user.id, pageIndex, maxPages));

    if(actionRows.length < 5) actionRows.push(...components);

    return {
        embeds: [embed],
        components: actionRows
    }
}

const alertTestResponse = async (interaction, success) => {
    if(success) {
        await interaction.followUp({
            embeds: [secondaryEmbed(s(interaction).info.ALERT_TEST_SUCCESSFUL)]
        });
    } else {
        await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.ALERT_NO_PERMS)]
        });
    }
}

const allStatsEmbed = async (interaction, stats, pageIndex=0) => {
    const skinCount = Object.keys(stats.items).length;

    if(skinCount === 0) return {
        embeds: [basicEmbed(client.config.VALORANT.trackStoreStats ? s(interaction).error.EMPTY_STATS : s(interaction).error.STATS_DISABLED)]
    }

    const maxPages = Math.ceil(skinCount / client.config.VALORANT.statsPerPage);

    if(pageIndex < 0) pageIndex = maxPages - 1;
    if(pageIndex >= maxPages) pageIndex = 0;

    const skinsToDisplay = Object.keys(stats.items).slice(pageIndex * client.config.VALORANT.statsPerPage, pageIndex * client.config.VALORANT.statsPerPage + client.config.VALORANT.statsPerPage);
    const embeds = [basicEmbed(s(interaction).info.STATS_HEADER.f({c: stats.shopsIncluded, p: pageIndex + 1, t: maxPages}))];
    for(const uuid of skinsToDisplay) {
        const skin = await getSkin(uuid);
        const statsForSkin = getStatsFor(uuid);
        embeds.push(await statsForSkinEmbed(skin, statsForSkin, interaction));
    }

    return {
        embeds: embeds,
        components: [pageButtons("changestatspage", interaction.user.id, pageIndex, maxPages)]
    }
}

const statsForSkinEmbed = async (skin, stats, interaction) => {
    let description;
    if(stats.count === 0) description = s(interaction).error.NO_STATS_FOR_SKIN.f({d: client.config.VALORANT.statsExpirationDays || '∞'});
    else {
        const percentage = Math.round(stats.count / stats.shopsIncluded * 100 * 100) / 100;
        const crownEmoji = stats.rank[0] === 1 || stats.rank[0] === stats.rank[1] ? ':crown: ' : '';
        description = s(interaction).info.STATS_DESCRIPTION.f({c: crownEmoji, r: stats.rank[0], t: stats.rank[1], p: percentage});
    }

    return {
        title: await skinNameAndEmoji(skin, interaction.channel, interaction),
        description: description,
        color: VAL_COLOR_2,
        thumbnail: {
            url: skin.icon
        }
    }
}

const accountsListEmbed = (interaction, userJson) => {
    const fields = [];
    for(const [i, account] of Object.entries(userJson.accounts)) {
        let fieldValue;
        if(!account.username) fieldValue = s(interaction).info.NO_USERNAME;
        else fieldValue = account.username;

        fields.push({
            name: `${parseInt(i) + 1}. ${userJson.currentAccount === parseInt(i) + 1 ? s(interaction).info.ACCOUNT_CURRENTLY_SELECTED : ''}`,
            value: fieldValue,
            inline: true
        });
    }

    const hideIgn = getSetting(interaction.user.id, "hideIgn");

    return {
        embeds: [{
            title: s(interaction).info.ACCOUNTS_HEADER,
            fields: fields,
            color: VAL_COLOR_1
        }],
        ephemeral: hideIgn
    }
}

const settingsEmbed = (userSettings, interaction) => {
    const embed = {
        title: s(interaction).settings.VIEW_HEADER,
        description: s(interaction).settings.VIEW_DESCRIPTION,
        color: VAL_COLOR_1,
        fields: []
    }

    for(const [setting, value] of Object.entries(userSettings)) {
        if(!settingIsVisible(setting)) continue;

        let displayValue = humanifyValue(
            setting === "locale" && !userSettings.localeForced ? "Automatic" : value,
            setting, interaction, true
        );

        embed.fields.push({
            name: settingName(setting, interaction),
            value: displayValue,
            inline: true
        });
    }

    return {
        embeds: [embed]
    }
}

const valMaintenancesEmbeds = (interaction, {maintenances, incidents, id: regionName}) => {
    const embeds = [];
    for(const maintenance of maintenances) {
        embeds.push(valMaintenanceEmbed(interaction, maintenance, false, regionName));
    }
    for(const incident of incidents) {
        embeds.push(valMaintenanceEmbed(interaction, incident, true, regionName));
    }

    if(!embeds.length) {
        embeds.push(basicEmbed(s(interaction).info.NO_MAINTENANCES.f({r: regionName})));
    }

    return {
        embeds: embeds
    }
}

const valMaintenanceEmbed = (interaction, target, isIncident, regionName) => {
    const update = target.updates[0] || {};
    const strings = update.translations || target.titles;
    const string = (strings.find(s => s.locale.replace('_', '-') === (discToValLang[interaction.locale] || DEFAULT_VALORANT_LANG)) || strings[0]).content;
    const lastUpdate = Math.round(new Date(update.created_at || target.created_at) / 1000);
    const targetType = isIncident ? s(interaction).info.INCIDENT_TYPE : s(interaction).info.MAINTENANCE_TYPE;

    return {
        title: s(interaction).info.MAINTENANCE_HEADER.f({t: targetType, r: regionName}),
        description: `> ${string}\n*${s(interaction).info.LAST_UPDATED.f({t: lastUpdate})}*`,
    }
}

const basicEmbed = (content) => {
    return {
        description: content,
        color: VAL_COLOR_1
    }
}

const headerEmbed = (content) => {
  return {
    description: content,
    color: 0x202225,
  };
};

const secondaryEmbed = (content) => {
    return {
        description: content,
        color: VAL_COLOR_2
    }
}

const createProgressBar = (totalxpneeded, currentxp, level) => {
    const totalxp = parseFloat(totalxpneeded.replace(/[,\.]/g, '')) + parseFloat(String(currentxp).replace(/[,\.]/g, '')); // I don't know why, but in the country I was in, the data had "." instead of ","

    const totalBars = 14; // Total number of bars and circles
    const filledBars = Math.floor((currentxp / totalxp) * totalBars);
    const emptyBars = totalBars - filledBars;

    const line = '▬';
    const circle = '⬤';

    const bar = line.repeat(filledBars) + circle + line.repeat(emptyBars);

    return level + '┃' + bar + '┃' + (parseInt(level) + 1);
}

const VPEmojiName = "ValPointsIcon";
const VPEmojiFilename = "assets/vp.png"; // https://media.valorant-api.com/currencies/85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741/largeicon.png

const RadEmojiName = "RadianiteIcon";
const RadEmojiFilename = "assets/rad.png"; // https://media.valorant-api.com/currencies/e59aa87c-4cbf-517a-5983-6e81511be9b7/displayicon.png

const KCEmojiName = "KingdomCreditIcon";
const KCEmojiFilename = "assets/kc.png"; // https://media.valorant-api.com/currencies/85ca954a-41f2-ce94-9b45-8ca3dd39a00d/displayicon.png

// the timestamp of the last time the emoji cache was updated for each guild
const lastEmojiFetch = {};

// a cache for emoji objects (note: due to sharding, might just be JSON representations of the emoji)
const emojiCache = {};

const VPEmoji = async (interaction, channel=interaction.channel) => emojiToString(await getOrCreateEmoji(channel, VPEmojiName, VPEmojiFilename)) || s(interaction).info.PRICE;
const RadEmoji = async (interaction, channel=interaction.channel) => emojiToString(await getOrCreateEmoji(channel, RadEmojiName, RadEmojiFilename));
const KCEmoji = async (interaction, channel=interaction.channel) => emojiToString(await getOrCreateEmoji(channel, KCEmojiName, KCEmojiFilename));

const rarityEmoji = async (channel, name, icon) => emojiToString(await getOrCreateEmoji(channel, `${name}Rarity`, icon));

const getOrCreateEmoji = async (channel, name, filenameOrUrl) => {
    if(!name || !filenameOrUrl) return;

    const guild = channel && channel.guild;

    // see if emoji exists already
    const emoji = emojiInGuild(guild, name);
    if(emoji && emoji.available) return addEmojiToCache(emoji);

    // check in other guilds
    const externalAllowed = externalEmojisAllowed(channel);
    if(externalAllowed) {
        if(client.config.VALORANT.useEmojisFromServer) {
            try {
                const emojiGuild = await client.guilds.fetch(client.config.VALORANT.useEmojisFromServer);
                if(!emojiGuild) console.error("useEmojisFromServer server not found! Either the ID is incorrect or I am not in that server anymore!");
                else {
                    await updateEmojiCache(emojiGuild);
                    const emoji = emojiInGuild(emojiGuild, name);
                    if(emoji && emoji.available) return addEmojiToCache(emoji);
                }
            } catch(e) {}
        }

        const cachedEmoji = emojiCache[name];
        if(cachedEmoji) return cachedEmoji;

        for(const otherGuild of client.guilds.cache.values()) {
            const emoji = emojiInGuild(otherGuild, name);
            if(emoji && emoji.available) return addEmojiToCache(emoji);
        }

        if(client.shard) {
            const results = await channel.client.shard.broadcastEval(findEmoji, { context: { name } });
            const emoji = results.find(e => e);
            if(emoji) return addEmojiToCache(emoji);
        }
    }

    // couldn't find usable emoji, create it
    if(guild) return addEmojiToCache(await createEmoji(guild, name, filenameOrUrl));
}

const emojiInGuild = (guild, name) => {
    return guild && guild.emojis.cache.find(emoji => emoji.name === name);
}

const createEmoji = async (guild, name, filenameOrUrl) => {
    if(!guild || !name || !filenameOrUrl) return;
    if(!canCreateEmojis(guild)) return console.log(`Don't have permission to create emoji ${name} in guild ${guild.name}!`);

    await updateEmojiCache(guild);
    if(guild.emojis.cache.filter(e => !e.animated).size >= maxEmojis(guild))
        return console.log(`Emoji limit of ${maxEmojis(guild)} reached for ${guild.name} while uploading ${name}!`);

    client.logger.debug(`Uploading emoji ${name} in ${guild.name}...`);
    try {
        const attachment = await resolveFilenameOrUrl(filenameOrUrl)
        return await guild.emojis.create({name, attachment});
    } catch(e) {
        console.error(`Could not create ${name} emoji in ${guild.name}! Either I don't have the right role or there are no more emoji slots`);
        console.error(`${e.name}: ${e.message}`);
    }
}

const resolveFilenameOrUrl = async (filenameOrUrl) => {
    if(filenameOrUrl.startsWith("http"))
        return filenameOrUrl;
    return await asyncReadFile(filenameOrUrl);
}

const updateEmojiCache = async (guild) => {
    if(!guild) return;
    if(!lastEmojiFetch[guild.id]) lastEmojiFetch[guild.id] = 0;
    if(Date.now() - lastEmojiFetch[guild.id] < client.config.VALORANT.emojiCacheExpiration) return; // don't update emoji cache multiple times per second

    await guild.emojis.fetch();

    lastEmojiFetch[guild.id] = Date.now();
    client.logger.debug(`Updated emoji cache for ${guild.name}`);
}

const addEmojiToCache = (emoji) => {
    if(emoji) emojiCache[emoji.name] = emoji;
    return emoji;
}

const findEmoji = (c, { name }) => {
    return c.emojis.cache.get(name) || c.emojis.cache.find(e => e.name.toLowerCase() === name.toLowerCase());
}

const maxEmojis = (guild) => {
    switch(guild.premiumTier) {
        case "NONE": return 50;
        case "TIER_1": return 100;
        case "TIER_2": return 150;
        case "TIER_3": return 250;
    }
}

// languages valorant doesn't have:
// danish, croatian, lithuanian, hungarian, dutch, norwegian, romanian, finnish, swedish, czech, greek, bulgarian, ukranian, hindi
// languages discord doesn't have:
// arabic, mexican spanish, indonesian
const discToValLang = {
    'de'   : 'de-DE',
    'en-GB': 'en-US', // :(
    'en-US': 'en-US',
    'es-ES': 'es-ES',
    'fr'   : 'fr-FR',
    'it'   : 'it-IT',
    'pl'   : 'pl-PL',
    'pt-BR': 'pt-BR',
    'vi'   : 'vi-VN',
    'tr'   : 'tr-TR',
    'ru'   : 'ru-RU',
    'th'   : 'th-TH',
    'zh-CN': 'zh-CN',
    'ja'   : 'ja-JP',
    'zh-TW': 'zh-TW',
    'ko'   : 'ko-KR',

    // valorant languages, that discord doesn't support
    'ar-AE': 'ar-AE',
    'es-MX': 'es-MX',
    'id-ID': 'id-ID'
}

const valToDiscLang = {};
Object.keys(discToValLang).forEach(discLang => {
    valToDiscLang[discToValLang[discLang]] = discLang;
});

const discLanguageNames = {
    'de'   : '🇳🇱 Deutsch',
    'en-GB': '🇬🇧 English (UK)',
    'en-US': '🇺🇸 English (US)',
    'es-ES': '🇪🇸 Español',
    'fr'   : '🇫🇷 Français',
    'it'   : '🇮🇹 Italiano',
    'pl'   : '🇵🇱 Polski',
    'pt-BR': '🇧🇷 Português (Brasil)',
    'vi'   : '🇻🇳 Tiếng Việt',
    'tr'   : '🇹🇷 Türkçe',
    'ru'   : '🇷🇺 Русский',
    'th'   : '🇹🇭 ไทย',
    'zh-CN': '🇨🇳 简体中文',
    'ja'   : '🇯🇵 日本語',
    'zh-TW': '🇹🇼 繁體中文',
    'ko'   : '🇰🇷 한국어',

    // valorant languages, that discord doesn't support
    'ar-AE': '🇸🇦 العربية',
    'es-MX': '🇲🇽 Español (México)',
    'id-ID': '🇮🇩 Bahasa Indonesia',

    // languages that neither discord nor valorant support
    'tl-PH': '🇵🇭 Tagalog',
}

const DEFAULT_LANG = 'en-GB';
const DEFAULT_VALORANT_LANG = 'en-US';

const languages = {};

const importLanguage = (language) => {
    let languageStrings;
    try {
        languageStrings = JSON.parse(fs.readFileSync(`./src/data/languages/${language}.json`, 'utf-8'));
    } catch (e) {
        if(language === DEFAULT_LANG) console.error(`Couldn't load ${DEFAULT_LANG}.json! Things will break.`);
        return;
    }

    if(language === DEFAULT_LANG) {
        languages[language] = languageStrings;
        return;
    }

    const languageHandler = {};
    for(const category in languageStrings) {
        if(typeof languageStrings[category] !== 'object') continue;
        languageHandler[category] = new Proxy(languageStrings[category], {
            get: (target, prop) => {
                if(prop in target) return target[prop];
                return languages[DEFAULT_LANG][category][prop] || prop;
            }
        });
    }

    for(const category in languages[DEFAULT_LANG]) {
        if(!languageHandler[category]) languageHandler[category] = languages[DEFAULT_LANG][category];
    }

    languages[language] = languageHandler;
}
importLanguage(DEFAULT_LANG);

// format a string
String.prototype.f = function(args, interactionOrId=null, hideName=true) {
    args = hideUsername(args, interactionOrId, hideName);
    let str = this;
    for(let i in args)
        str = str.replace(`{${i}}`, args[i]);
    return str;
}

const f = (string, args, interactionOrId=null, hideName=true) => {
    args = hideUsername(args, interactionOrId, hideName);
    let str = string;
    for(let i in args)
        str = str.replace(`{${i}}`, args[i]);
    return str;
}

// get the strings for a language
const s = (input) => {
    const discLang = resolveDiscordLanguage(input);

    if(!languages[discLang]) importLanguage(discLang);
    return languages[discLang] || languages[DEFAULT_LANG];
}

// get the skin/bundle name in a language
const l = (names, input) => {
    let discLocale = resolveDiscordLanguage(input);
    let valLocale = discToValLang[discLocale];
    return names[valLocale] || names[DEFAULT_VALORANT_LANG];
}

// input can be a valorant user, an interaction, a discord id, a language code, or null
const resolveDiscordLanguage = (input) => {
    let discLang;

    if(!input) discLang = DEFAULT_LANG;
    if(typeof input === 'string') {
        const user = getUser(input);
        if(user) input = user;
        else discLang = input;
    }
    if(input instanceof User) discLang = getSetting(input.id, 'locale');
    if(input instanceof BaseInteraction) discLang = getSetting(input.user.id, 'locale');


    if(discLang === "Automatic") {
        if(client.config.VALORANT.localiseSkinNames) discLang = input.locale;
        else discLang = DEFAULT_LANG;
    }
    if(!discLang) discLang = DEFAULT_LANG;

    return discLang;
}

const hideUsername = (args, interactionOrId, hideName = true) => {
    if(!args.u) return {...args, u: s(interactionOrId).info.NO_USERNAME};
    if(!interactionOrId) return args;

    const id = typeof interactionOrId === 'string' ? interactionOrId : interactionOrId.user.id;
    const hide = hideName ? getSetting(id, 'hideIgn') : false;
    if(!hide) return args;

    return {...args, u: `||*${s(interactionOrId).info.HIDDEN_USERNAME}*||`};
}

const messagesToLog = [];

const oldLog = console.log;
const oldError = console.error;

const shardString = () => client.shard ? `[${client.shard.ids[0]}] ` : "";
const localLog = (...args) => oldLog(shardString(), ...args);
const localError = (...args) => oldError(shardString(), ...args);

const loadLogger = () => {
    console.log = (...args) => {
        oldLog(shardString(), ...args);
        if(client.config.VALORANT.logToChannel) messagesToLog.push(shardString() + escapeMarkdown(args.join(" ")));
    }

    console.error = (...args) => {
        oldError(shardString(), ...args);
        if(client.config.VALORANT.logToChannel) messagesToLog.push("> " + shardString() + escapeMarkdown(args.map(e => (e instanceof Error ? e.stack : e.toString()).split('\n').join('\n> ' + shardString())).join(" ")));
    }
}

const addMessagesToLog = (messages) => {
    if(!messages.length) return;

    const channel = client.channels.cache.get(client.config.VALORANT.logToChannel);
    if(!channel) {
        // localLog("I'm not the right shard for logging! ignoring log messages")
        return;
    }

    // localLog(`Adding ${messages.length} messages to log...`);

    messagesToLog.push(...messages);
}

const sendConsoleOutput = () => {
    try {
        if(!client || client.destroyed || !messagesToLog.length) return;

        const channel = client.channels.cache.get(client.config.VALORANT.logToChannel);

        if(!channel && client.shard) {
            if(messagesToLog.length > 0) sendShardMessage({
                type: "logMessages",
                messages: [...messagesToLog]
            })
        }
        else if(channel) {
            while(messagesToLog.length) {
                let s = "";
                while(messagesToLog.length && s.length + messagesToLog[0].length < 2000)
                    s += messagesToLog.shift() + "\n";

                channel.send(s);
            }
        }

        messagesToLog.length = 0;
    } catch(e) {
        localError("Error when trying to send the console output to the channel!");
        localError(e)
    }
}

const useMultiqueue = () => client.config.VALORANT.useMultiqueue && client.shard && client.shard.ids[0] !== 0;

let mqMessageId = 0;
const callbacks = {};
const setCallback = (mqid, callback) => callbacks[parseInt(mqid)] = callback;

const sendMQRequest = async (type, params={}, callback=()=>{}) => {
    const message = {
        type: "mqrequest",
        mqid: `${client.shard.ids[0]}:${++mqMessageId}`,
        mqtype: type,
        params
    }

    setCallback(mqMessageId, callback);
    await sendShardMessage(message);
}

const sendMQResponse = async (mqid, params={}) => {
    const message = {
        type: "mqresponse",
        mqid,
        params
    }

    await sendShardMessage(message);
}

const handleMQRequest = async (message) => {
    if(!client.shard.ids.includes(0)) return;

    await mqProcessRequest(message);
}

const handleMQResponse = async (message) => {
    const [shardId, mqid] = message.mqid.split(":");

    // check the response is intended for this shard
    if(!client.shard.ids.includes(parseInt(shardId))) return;

    // check we have a callback registered
    if(!callbacks[mqid]) return console.error(`No callback registered for MQ response ${message.mqid}!`);

    // do the thing
    callbacks[mqid](message);
    delete callbacks[mqid];
}


// =====================

const mqSendMessage  = async (type, params={}) => {
    return new Promise((resolve, reject) => {
        sendMQRequest(type, params, (message) => {
            if(message.error) reject(message.error);
            else resolve(message.params);
        });
    });
}

const mqGetShop = async (id, account=null) => await mqSendMessage("getShop", {id, account});
const mqLoginUsernamePass = async (id, username, password) => await mqSendMessage("loginUsernamePass", {id, username, password});
const mqLogin2fa = async (id, code) => await mqSendMessage("login2fa", {id, code});
const mqLoginCookies = async (id, cookies) => await mqSendMessage("loginCookies", {id, cookies});
const mqNullOperation = async (timeout) => await mqSendMessage("nullOperation", {timeout});
const mqGetAuthQueueItemStatus = async (c) => await mqSendMessage("getAuthQueueItemStatus", {c});


const mqProcessRequest = async ({mqid, mqtype, params}) => {
    console.log("Processing MQ request", mqid, mqtype, JSON.stringify(params).substring(0, 200));

    let response;
    switch(mqtype) {
        case "getShop": {
            const {id, account} = params;
            response = await getShop(id, account);
            break;
        }

        case "loginUsernamePass": {
            const {id, username, password} = params;
            response = await queueUsernamePasswordLogin(id, username, password);
            break;
        }

        case "login2fa": {
            const {id, code} = params;
            response = await queue2FACodeRedeem(id, code);
            break;
        }

        case "loginCookies": {
            const {id, cookies} = params;
            response = await queueCookiesLogin(id, cookies);
            break;
        }

        case "nullOperation": {
            const {timeout} = params;
            response = await queueNullOperation(timeout);
            break;
        }

        case "getAuthQueueItemStatus": {
            const {c} = params;
            response = await getAuthQueueItemStatus(c);
            break;
        }
    }

    await sendMQResponse(mqid, response);
}

const rateLimits = {};

const checkRateLimit = (req, url) => {
    let rateLimited = req.statusCode === 429 || req.headers.location?.startsWith("/auth-error?error=rate_limited");
    if(!rateLimited) try {
        const json = JSON.parse(req.body);
        rateLimited = json.error === "rate_limited";
    } catch(e) {}

    if(rateLimited) {
        let retryAfter = parseInt(req.headers['retry-after']) + 1;
        if(retryAfter) {
            console.log(`I am ratelimited at ${url} for ${retryAfter - 1} more seconds!`);
            if(retryAfter > client.config.VALORANT.rateLimitCap) {
                console.log(`Delay higher than rateLimitCap, setting it to ${client.config.VALORANT.rateLimitCap} seconds instead`);
                retryAfter = client.config.VALORANT.rateLimitCap;
            }
        }
        else {
            retryAfter = client.config.VALORANT.rateLimitBackoff;
            console.log(`I am temporarily ratelimited at ${url} (no ETA given, waiting ${client.config.VALORANT.rateLimitBackoff}s)`);
        }

        const retryAt = Date.now() + retryAfter * 1000;
        rateLimits[url] = retryAt;
        return retryAt;
    }

    return false;
}

const isRateLimited = (url) => {
    const retryAt = rateLimits[url];

    if(!retryAt) return false;

    if(retryAt < Date.now()) {
        delete rateLimits[url];
        return false;
    }

    const retryAfter = (retryAt - Date.now()) / 1000;
    console.log(`I am still ratelimited at ${url} for ${retryAfter} more seconds!`);

    return retryAt;
}

const settings = {
    dailyShop: { // stores false or channel id
        set: (value, interaction) => value === 'true' ? interaction.channelId : false,
        render: (value) => {
            if(value?.startsWith?.('#')) return value;
            return value ? `<#${value}>` : false;
        },
        choices: (interaction) => [`#${interaction.channel?.name || s(interaction).info.ALERT_IN_DM_CHANNEL}`, false],
        values: [true, false],
        default: false
    },
    hideIgn: {
        values: [true, false],
        default: false
    },
    othersCanViewShop: {
        values: [true, false],
        default: true
    },
    othersCanViewColl: {
        values: [true, false],
        default: true
    },
    locale: {
        values: ["Automatic"], // locales will be added after imports finished processing
        default: "Automatic"
    },
    localeForced: {
        hidden: true
    }
}

// required due to circular dependency
setTimeout(() => settings.locale.values.push(...Object.keys(discLanguageNames)))

const defaultSettings = {};
for(const setting in settings) defaultSettings[setting] = settings[setting].default;

const getSettings = (id) => {
    const json = readUserJson(id);
    if(!json) return defaultSettings;

    if(!json.settings) {
        json.settings = defaultSettings
        saveUserJson(id, json);
    }
    else {
        let changed = false;

        for(const setting in defaultSettings) {
            if(!(setting in json.settings)) {
                json.settings[setting] = defaultSettings[setting];
                changed = true;
            }
        }

        for(const setting in json.settings) {
            if(!(setting in defaultSettings)) {
                delete json.settings[setting];
                changed = true;
            }
        }

        if(changed) saveUserJson(id, json);
    }

    return json.settings;
}

const getSetting = (id, setting) => {
    return getSettings(id)[setting];
}

const setSetting = (interaction, setting, value, force=false) => { // force = whether is set from /settings set
    const id = interaction.user.id;
    const json = readUserJson(id);
    if(!json) return defaultSettings[setting]; // returns the default setting if the user does not have an account (this method may be a little bit funny, but it's better than an error)

    if(setting === "locale") {
        if(force) {
            json.settings.localeForced = value !== "Automatic";
            json.settings.locale = json.settings.localeForced ? computerifyValue(value) : "Automatic";
        }
        else if(!json.settings.localeForced) {
            json.settings.locale = value;
        }
    }
    else {
        let setValue = settings[setting].set ? settings[setting].set(value, interaction) : value;
        json.settings[setting] = computerifyValue(setValue);
    }

    saveUserJson(id, json);

    return json.settings[setting];
}

const registerInteractionLocale = (interaction) => {
    const settings = getSettings(interaction.user.id);
    if(!settings.localeForced && settings.locale !== interaction.locale)
        setSetting(interaction, "locale", interaction.locale);
}

const handleSettingsViewCommand = async (interaction) => {
    const settings = getSettings(interaction.user.id);

    await interaction.followUp(settingsEmbed(settings, interaction));
}

const handleSettingsSetCommand = async (interaction) => {
    const setting = interaction.options.getString("setting");

    const settingValues = settings[setting].values;
    const choices = settings[setting].choices?.(interaction) || [];

    const row = new ActionRowBuilder();

    const options = settingValues.slice(0, 25).map(value => {
        return {
            label: humanifyValue(choices.shift() || value, setting, interaction),
            value: `${setting}/${value}`
        }
    });

    row.addComponents(new StringSelectMenuBuilder().setCustomId("set-setting").addOptions(options));

    await interaction.followUp({
        embeds: [secondaryEmbed(s(interaction).settings.SET_QUESTION.f({s: settingName(setting, interaction)}))],
        components: [row]
    });
}

const handleSettingDropdown = async (interaction) => {
    const [setting, value] = interaction.values[0].split('/');

    const valueSet = setSetting(interaction, setting, value, true);

    await interaction.update({
        embeds: [basicEmbed(s(interaction).settings.CONFIRMATION.f({s: settingName(setting, interaction), v: humanifyValue(valueSet, setting, interaction)}))],
        components: []
    });
}

const settingName = (setting, interaction) => {
    return s(interaction).settings[setting];
}

const settingIsVisible = (setting) => {
    return !settings[setting].hidden;
}

const humanifyValue = (value, setting, interaction, emoji=false) => {
    if(settings[setting].render) value = settings[setting].render(value, interaction);
    if(value === true) return emoji ? '✅' : s(interaction).settings.TRUE;
    if(value === false) return emoji ? '❌' : s(interaction).settings.FALSE;
    if(value === "Automatic") return (emoji ? "🌐 " : '') + s(interaction).settings.AUTO;
    if(Object.keys(discLanguageNames).includes(value)) return discLanguageNames[value];
    return value.toString();
}

const computerifyValue = (value) => {
    if(["true", "false"].includes(value)) return value === "true";
    if(!isNaN(parseInt(value)) && value.length < 15) return parseInt(value); // do not parse discord IDs
    if(Object.values(discLanguageNames).includes(value)) return findKeyOfValue(discLanguageNames, value);
    return value;
}

let allShardsReadyCb;
let allShardsReadyPromise = new Promise(r => allShardsReadyCb = r);

const areAllShardsReady = () => {
    return !client.shard || allShardsReadyPromise === null;
}

const sendShardMessage = async (message) => {
    if(!client.shard) return;

    await allShardsReadyPromise;

    if(message.type !== "logMessages") localLog(`Sending message to other shards: ${JSON.stringify(message).substring(0, 100)}`);

    // I know this is a weird way of doing this, but trust me
    // client.shard.send() did not want to work for the life of me
    // and this solution seems to work, so should be fine lol
    await client.shard.broadcastEval((client, context) => {
        client.skinPeekShardMessageReceived(context.message);
    }, {context: {message}});
}

const receiveShardMessage = async (message) => {
    //oldLog(`Received shard message ${JSON.stringify(message).substring(0, 100)}`);
    switch(message.type) {
        case "shardsReady":
            // also received when a shard dies and respawns
            if(allShardsReadyPromise === null) return;

            localLog(`All shards are ready!`);
            allShardsReadyPromise = null;
            allShardsReadyCb();
            break;
        case "mqrequest":
            await handleMQRequest(message);
            break;
        case "mqresponse":
            await handleMQResponse(message);
            break;
        case "alert":
            await sendAlert(message.id, message.account, message.alerts, message.expires, false);
            break;
        case "dailyShop":
            await sendDailyShop(message.id, message.shop, message.channelId, message.valorantUser, false);
            break;
        case "credentialsExpired":
            await sendCredentialsExpired(message.id, message.alert, false);
            break;
        case "checkAlerts":
            await checkAlerts();
            break;
        case "configReload":
            // loadConfig();
            destroyTasks();
            scheduleTasks();
            break;
        case "skinsReload":
            await loadSkinsJSON();
            break;
        case "logMessages":
            addMessagesToLog(message.messages);
            break;
        case "processExit":
            process.exit();
            break;
    }
};

// setTimeout(() => client.skinPeekShardMessageReceived = receiveShardMessage);

let stats = {
    fileVersion: 2,
    stats: {}
};
let overallStats = {
    shopsIncluded: 0,
    items: {}
};

const loadStats = (filename="src/data/stats.json") => {
    if(!client.config.VALORANT.trackStoreStats) return;
    try {
        const obj = JSON.parse(fs.readFileSync(filename).toString());

        if(!obj.fileVersion) transferStatsFromV1(obj);
        else stats = obj;
        

        saveStats(filename);

        calculateOverallStats();
    } catch(e) {}
}

const saveStats = (filename="src/data/stats.json") => {
    fs.writeFileSync(filename, JSON.stringify(stats, null, 2));
}

const calculateOverallStats = () => {
    cleanupStats();

    overallStats = {
        shopsIncluded: 0,
        items: {}
    }
    let items = {};

    for(let dateString in stats.stats) {
        if(client.config.VALORANT.statsExpirationDays && daysAgo(dateString) > client.config.VALORANT.statsExpirationDays) {
            // delete stats.stats[dateString];
            continue;
        }
        const dayStats = stats.stats[dateString];

        overallStats.shopsIncluded += dayStats.shopsIncluded;
        for(let item in dayStats.items) {
            if(item in items) {
                items[item] += dayStats.items[item];
            } else {
                items[item] = dayStats.items[item];
            }
        }
    }

    const sortedItems = Object.entries(items).sort(([,a], [,b]) => b - a);
    for(const [uuid, count] of sortedItems) {
        overallStats.items[uuid] = count;
    }
}

const getOverallStats = () => {
    loadStats();
    return overallStats || {};
}

const getStatsFor = (uuid) => {
    loadStats();
    return {
        shopsIncluded: overallStats.shopsIncluded,
        count: overallStats.items[uuid] || 0,
        rank: [Object.keys(overallStats.items).indexOf(uuid) + 1, Object.keys(overallStats.items).length]
    }
}

const addStore = (puuid, items) => {
    if(!client.config.VALORANT.trackStoreStats) return;

    loadStats();

    const today = formatDate(new Date());

    let todayStats = stats.stats[today];
    if(!todayStats) {
        todayStats = {
            shopsIncluded: 0,
            items: {},
            users: []
        };
        stats.stats[today] = todayStats;
    }

    if(todayStats.users.includes(puuid)) return;
    todayStats.users.push(puuid);

    for(const item of items) {
        if(item in todayStats.items) {
            todayStats.items[item]++;
        } else {
            todayStats.items[item] = 1;
        }
    }
    todayStats.shopsIncluded++;

    saveStats();

    calculateOverallStats();
}

const cleanupStats = () => {
    if(!client.config.VALORANT.statsExpirationDays) return;

    for(const dateString in stats.stats) {
        if(daysAgo(dateString) > client.config.VALORANT.statsExpirationDays) {
            delete stats.stats[dateString];
        }
    }

    saveStats();
}

const formatDate = (date) => {
    return `${date.getUTCDate()}-${date.getUTCMonth() + 1}-${date.getUTCFullYear()}`;
}

const daysAgo = (dateString) => {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const [day, month, year] = dateString.split("-");
    const date = new Date(Date.UTC(year, month - 1, day));

    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

const transferStatsFromV1 = (obj) => {
    stats.stats[formatDate(new Date())] = {
        shopsIncluded: obj.shopsIncluded,
        items: obj.itemStats,
        users: obj.usersAddedToday
    };
}

const tlsCiphers = [
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-ECDSA-AES128-SHA256',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-AES128-SHA',
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-ECDSA-AES256-SHA',
    'ECDHE-RSA-AES256-SHA',
    'RSA-PSK-AES128-GCM-SHA256',
    'RSA-PSK-AES256-GCM-SHA384',
    'RSA-PSK-AES128-CBC-SHA',
    'RSA-PSK-AES256-CBC-SHA',
];

const tlsSigAlgs = [
    'ecdsa_secp256r1_sha256',
    'rsa_pss_rsae_sha256',
    'rsa_pkcs1_sha256',
    'ecdsa_secp384r1_sha384',
    'rsa_pss_rsae_sha384',
    'rsa_pkcs1_sha384',
    'rsa_pss_rsae_sha512',
    'rsa_pkcs1_sha512',
    'rsa_pkcs1_sha1',
]

// all my homies hate node-fetch
const fetch = (url, options={}) => {
    if(client.config.VALORANT.logUrls) console.log("Fetching url " + url.substring(0, 200) + (url.length > 200 ? "..." : ""));

    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            agent: options.proxy,
            method: options.method || "GET",
            headers: {
                cookie: "dummy=cookie", // set dummy cookie, helps with cloudflare 1020
                "Accept-Language": "en-US,en;q=0.5", // same as above
                "referer": "https://github.com/giorgi-o/SkinPeek", // to help other APIs (e.g. Spirit's) see where the traffic is coming from
                ...options.headers
            },
            ciphers: tlsCiphers.join(':'),
            sigalgs: tlsSigAlgs.join(':'),
            minVersion: "TLSv1.3",
        }, resp => {
            const res = {
                statusCode: resp.statusCode,
                headers: resp.headers
            };
            let chunks = [];
            resp.on('data', (chunk) => chunks.push(chunk));
            resp.on('end', () => {
                res.body = Buffer.concat(chunks).toString(options.encoding || "utf8");
                resolve(res);
            });
            resp.on('error', err => {
                console.error(err);
                reject(err);
            });
        });
        req.write(options.body || "");
        req.end();
        req.on('error', err => {
            console.error(err);
            reject(err);
        });
    });
}

const ProxyType = {
    HTTPS: "https",
    // SOCKS4: "socks4", // not supported yet
    // SOCKS5: "socks5", // not supported yet
}

class ValoProxy {
    constructor({manager, type, host, port, username, password}) {
        this.manager = manager;
        this.type = type || ProxyType.HTTPS;
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;

        this.publicIp = null;
    }

    createAgent(hostname) {
        if(this.type !== ProxyType.HTTPS) throw new Error("Unsupported proxy type " + this.type);

        return new Promise((resolve, reject) => {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
            "Host": hostname,
        };
        if(this.username && this.password) {
            headers["Proxy-Authorization"] = "Basic " + Buffer.from(this.username + ":" + this.password).toString("base64");
        }

        const req = http.request({
            host: this.host,
            port: this.port,
            method: "CONNECT",
            path: hostname + ":443",
            headers: headers,
            timeout: 10,
        });
        client.logger.debug(`Sent proxy connection request to ${this.host}:${this.port} for ${hostname}`);

        req.on("connect", (res, socket) => {
            console.log(`Proxy ${this.host}:${this.port} connected to ${hostname}!`);
            if (res.statusCode !== 200) {
                reject(`Proxy ${this.host}:${this.port} returned status code ${res.statusCode}!`);
            }

            socket.on("error", err => {
                console.error(`Proxy ${this.host}:${this.port} socket errored: ${err}`);
                this.manager.proxyIsDead(this, hostname);
            });

            const agent = new https.Agent({ socket });
            resolve(agent);
        });

        req.on("error", err => {
            reject(`Proxy ${this.host}:${this.port} errored: ${err}`);
        });

        req.end();
        });
    }

    async test() {
        const res = await fetch("https://api.ipify.org", {proxy: await this.createAgent("api.ipify.org")});

        if(res.statusCode !== 200) {
            console.error(`Proxy ${this.host}:${this.port} returned status code ${res.statusCode}!`);
            return false;
        }

        const ip = res.body.trim();
        if(!ip) {
            console.error(`Proxy ${this.host}:${this.port} returned no IP!`);
            return false;
        }

        this.publicIp = ip;
        return true;
    }
}

class ProxyManager {
    constructor() {
        this.allProxies = [];

        this.activeProxies = {
            "example.com": []
        };
        this.deadProxies = [];

        this.enabled = false;
    }

    async loadProxies() {
        const proxyFile = await asyncReadFile("src/data/proxies.txt").catch(_ => {});
        if(!proxyFile) return;

        let type = ProxyType.HTTPS;
        let username = null;
        let password = null;

        // for each line in proxies.txt
        for(const line of proxyFile.toString().split("\n")) {
            const trimmed = line.trim();
            if(!trimmed.length || trimmed.startsWith("#")) continue;

            // split by colons
            const parts = trimmed.split(":");
            if(parts.length < 2) continue;

            // first part is the proxy host
            const host = parts[0];
            if(!host.length) continue;

            // second part is the proxy port
            const port = parseInt(parts[1]);
            if(isNaN(port)) continue;

            // third part is the proxy type
            type = parts[2]?.toLowerCase() || ProxyType.HTTPS;
            if(type !== ProxyType.HTTPS) {
                console.error(`Unsupported proxy type ${type}!`);
                type = ProxyType.HTTPS;
                continue;
            }

            // fourth part is the proxy username
            username = parts[3] || null;

            // fifth part is the proxy password
            password = parts[4] || null;

            // create the proxy object
            const proxy = new ValoProxy({
                type, host, port, username, password,
                manager: this
            });

            // add it to the list of all proxies
            this.allProxies.push(proxy);
        }

        this.enabled = this.allProxies.length > 0;
    }

    async loadForHostname(hostname) {
        if(!this.enabled) return;

        // called both to load the initial set of proxies for a hostname,
        // and to repopulate the list if the current set has an invalid one

        const activeProxies = this.activeProxies[hostname] || [];
        const promises = [];

        const proxyFailed = async proxy => {
            this.deadProxies.push(proxy);
        }

        for(const proxy of this.allProxies) {
            if(!this.allProxies.length) break;
            if(activeProxies.length >= client.config.VALORANT.maxActiveProxies) break;
            if(activeProxies.includes(proxy)) continue;
            if(this.deadProxies.includes(proxy)) continue;

            /*try {
                const proxyWorks = await proxy.test();
                if(!proxyWorks) {
                    this.deadProxies.push(proxy);
                    continue;
                }

                await proxy.createAgent(hostname);
                activeProxies.push(proxy);
            } catch(err) {
                console.error(err);
                this.deadProxies.push(proxy);
            }*/

            let timedOut = false;
            const promise = proxy.test().then(proxyWorks => {
                if(!proxyWorks) return Promise.reject(`Proxy ${proxy.host}:${proxy.port} failed!`);
                if(timedOut) return Promise.reject();

                return proxy.createAgent(hostname);
            }).then((/*agent*/) => {
                if(timedOut) return;

                activeProxies.push(proxy);
            }).catch(err => {
                if(err) console.error(err);
                proxyFailed(proxy);
            });

            const promiseWithTimeout = promiseTimeout(promise, 5000).then(res => {
                if(res === null) {
                    timedOut = true;
                    console.error(`Proxy ${proxy.host}:${proxy.port} timed out!`);
                }
            });
            promises.push(promiseWithTimeout);
        }

        await Promise.all(promises);

        if(!activeProxies.length) {
            console.error(`No working proxies found!`);
            return;
        }

        console.log(`Loaded ${activeProxies.length} proxies for ${hostname}`);
        this.activeProxies[hostname] = activeProxies;

        return activeProxies;
    }

    async getProxy(hostname) {
        if(!this.enabled) return null;

        const activeProxies = await this.loadForHostname(hostname);
        if(!activeProxies?.length) return null;

        let proxy;
        do {
            proxy = activeProxies.shift();
        } while(this.deadProxies.includes(proxy));
        if(!proxy) return null;

        activeProxies.push(proxy);
        return proxy;
    }

    async getProxyForUrl(url) {
        const hostname = new URL(url).hostname;
        return this.getProxy(hostname);
    }

    async proxyIsDead(proxy, hostname) {
        this.deadProxies.push(proxy);
        await this.loadForHostname(hostname);
    }

    async fetch(url, options = {}) {
        // if(!this.enabled) return await fetch(url, options);
        if(!this.enabled) return;

        const hostname = new URL(url).hostname;
        const proxy = await this.getProxy(hostname);
        if(!proxy) return await fetch(url, options);

        const agent = await proxy.createAgent(hostname);
        const req = await fetch(url, {
            ...options,
            proxy: agent.createConnection
        });

        // test for 1020 or rate limit
        const hostnameAndProxy = `${new URL(url).hostname} proxy=${proxy.host}:${proxy.port}`
        if(req.statusCode === 403 && req.body === "error code: 1020" || checkRateLimit(req, hostnameAndProxy)) {
            console.error(`Proxy ${proxy.host}:${proxy.port} is dead!`);
            console.error(req);
            await this.proxyIsDead(proxy, hostname);
            return await this.fetch(url, options);
        }
    }
}

const proxyManager = new ProxyManager();
const initProxyManager = async () => await proxyManager.loadProxies();
const getProxyManager = () => proxyManager;

// file utils

const asyncReadFile = (path) => {
    return new Promise(((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if(err) reject(err);
            else resolve(data);
        })
    }));
}

const asyncReadJSONFile = async (path) => {
    return JSON.parse((await asyncReadFile(path)).toString());
}

// riot utils

const WeaponType = {
    Classic: "Classic",
    Shorty: "Shorty",
    Frenzy: "Frenzy",
    Ghost: "Ghost",
    Sheriff: "Sheriff",

    Stinger: "Stinger",
    Spectre: "Spectre",
    Bucky: "Bucky",
    Judge: "Judge",

    Bulldog: "Bulldog",
    Guardian: "Guardian",
    Phantom: "Phantom",
    Vandal: "Vandal",

    Marshal: "Marshal",
    Operator: "Operator",
    Ares: "Ares",
    Odin: "Odin",
    Knife: "Knife",
}

const WeaponTypeUuid = {
    [WeaponType.Odin]: "63e6c2b6-4a8e-869c-3d4c-e38355226584",
    [WeaponType.Ares]: "55d8a0f4-4274-ca67-fe2c-06ab45efdf58",
    [WeaponType.Vandal]: "9c82e19d-4575-0200-1a81-3eacf00cf872",
    [WeaponType.Bulldog]: "ae3de142-4d85-2547-dd26-4e90bed35cf7",
    [WeaponType.Phantom]: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a",
    [WeaponType.Judge]: "ec845bf4-4f79-ddda-a3da-0db3774b2794",
    [WeaponType.Bucky]: "910be174-449b-c412-ab22-d0873436b21b",
    [WeaponType.Frenzy]: "44d4e95c-4157-0037-81b2-17841bf2e8e3",
    [WeaponType.Classic]: "29a0cfab-485b-f5d5-779a-b59f85e204a8",
    [WeaponType.Ghost]: "1baa85b4-4c70-1284-64bb-6481dfc3bb4e",
    [WeaponType.Sheriff]: "e336c6b8-418d-9340-d77f-7a9e4cfe0702",
    [WeaponType.Shorty]: "42da8ccc-40d5-affc-beec-15aa47b42eda",
    [WeaponType.Operator]: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7",
    [WeaponType.Guardian]: "4ade7faa-4cf1-8376-95ef-39884480959b",
    [WeaponType.Marshal]: "c4883e50-4494-202c-3ec3-6b8a9284f00b",
    [WeaponType.Spectre]: "462080d1-4035-2937-7c09-27aa2a5c27a7",
    [WeaponType.Stinger]: "f7e1b454-4ad4-1063-ec0a-159e56b58941",
    [WeaponType.Knife]: "2f59173c-4bed-b6c3-2191-dea9b58be9c7",
}

const itemTypes = {
    SKIN: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",
    BUDDY: "dd3bf334-87f3-40bd-b043-682a57a8dc3a",
    SPRAY: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",
    CARD: "3f296c07-64c3-494c-923b-fe692a4fa1bd",
    TITLE: "de7caa6b-adf7-4588-bbd1-143831e786c6"
}

const parseSetCookie = (setCookie) => {
    if(!setCookie) {
        console.error("Riot didn't return any cookies during the auth request! Cloudflare might have something to do with it...");
        return {};
    }

    const cookies = {};
    for(const cookie of setCookie) {
        const sep = cookie.indexOf("=");
        cookies[cookie.slice(0, sep)] = cookie.slice(sep + 1, cookie.indexOf(';'));
    }
    return cookies;
}

const stringifyCookies = (cookies) => {
    const cookieList = [];
    for (let [key, value] of Object.entries(cookies)) {
        cookieList.push(key + "=" + value);
    }
    return cookieList.join("; ");
}

const extractTokensFromUri = (uri) => {
    // thx hamper for regex
    const match = uri.match(/access_token=((?:[a-zA-Z]|\d|\.|-|_)*).*id_token=((?:[a-zA-Z]|\d|\.|-|_)*).*expires_in=(\d*)/);
    if(!match) return [null, null];

    const [, accessToken, idToken] = match;
    return [accessToken, idToken]
}

const decodeToken = (token) => {
    const encodedPayload = token.split('.')[1];
    return JSON.parse(atob(encodedPayload));
}

const tokenExpiry = (token) => {
    return decodeToken(token).exp * 1000;
}

const userRegion = ({region}) => {
    if(!region || region === "latam" || region === "br") return "na";
    return region;
}

const isMaintenance = (json) => {
    return json.httpStatus === 403 && json.errorCode === "SCHEDULED_DOWNTIME";
}

const formatBundle = async (rawBundle) => {
    const bundle = {
        uuid: rawBundle.DataAssetID,
        expires: Math.floor(Date.now() / 1000) + rawBundle.DurationRemainingInSeconds,
        items: []
    }

    let price = 0;
    let basePrice = 0;
    for(const rawItem of rawBundle.Items) {
        const item = {
            uuid: rawItem.Item.ItemID,
            type: rawItem.Item.ItemTypeID,
            item: await getItem(rawItem.Item.ItemID, rawItem.Item.ItemTypeID),
            amount: rawItem.Item.Amount,
            price: rawItem.DiscountedPrice,
            basePrice: rawItem.BasePrice,
            discount: rawItem.DiscountPercent
        }

        price += item.price;
        basePrice += item.basePrice;

        bundle.items.push(item);
    }

    bundle.price = price;
    bundle.basePrice = basePrice;

    return bundle;
}

const fetchMaintenances = async (region) => {
    const req = await fetch(`https://valorant.secure.dyn.riotcdn.net/channels/public/x/status/${region}.json`);
    return JSON.parse(req.body);
}

const formatNightMarket = (rawNightMarket) => {
    if(!rawNightMarket) return null;

    return {
        offers: rawNightMarket.BonusStoreOffers.map(offer => {return {
            uuid: offer.Offer.OfferID,
            realPrice: offer.Offer.Cost["85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741"],
            nmPrice: offer.DiscountCosts["85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741"],
            percent: offer.DiscountPercent
        }}),
        expires: Math.floor(Date.now() / 1000) + rawNightMarket.BonusStoreRemainingDurationInSeconds
    }
}

const removeDupeAlerts = (alerts) => {
    const uuids = [];
    return alerts.filter(alert => {
        if(uuids.includes(alert.uuid)) return false;
        return uuids.push(alert.uuid);
    });
}

const getPuuid = (id, account=null) => {
    return getUser(id, account).puuid;
}

const isDefaultSkin = (skin) => skin.skinUuid === skin.defaultSkinUuid;

// discord utils

const defer = async (interaction, ephemeral=false) => {
    // discord only sets deferred to true once the event is sent over ws, which doesn't happen immediately
    await interaction.deferReply({ephemeral});
    interaction.deferred = true;
}

const skinNameAndEmoji = async (skin, channel, localeOrInteraction=DEFAULT_LANG) => {
    const name = l(skin.names, localeOrInteraction);
    if(!skin.rarity) return name;

    const rarity = await getRarity(skin.rarity, channel);
    if(!rarity) return name;

    const rarityIcon = await rarityEmoji(channel, rarity.name, rarity.icon);
    return rarityIcon ? `${rarityIcon} ${name}` : name;
}

const actionRow = (button) => new ActionRowBuilder().addComponents(button);

const removeAlertButton = (id, uuid, buttonText) => new ButtonBuilder().setCustomId(`removealert/${uuid}/${id}/${Math.round(Math.random() * 100000)}`).setStyle(ButtonStyle.Danger).setLabel(buttonText).setEmoji("✖");
const removeAlertActionRow = (id, uuid, buttonText) => new ActionRowBuilder().addComponents(removeAlertButton(id, uuid, buttonText));

const retryAuthButton = (id, operationId, buttonText) => new ButtonBuilder().setCustomId(`retry_auth/${operationId}`).setStyle(ButtonStyle.Danger).setLabel(buttonText).setEmoji("🔄");

const externalEmojisAllowed = (channel) => !channel || !channel.guild || channel.permissionsFor(channel.guild.roles.everyone).has(PermissionsBitField.Flags.UseExternalEmojis);
const canCreateEmojis = (guild) => guild && guild.members.me && guild.members.me.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers);
const emojiToString = (emoji) => emoji && `<:${emoji.name}:${emoji.id}>`;

const canSendMessages = (channel) => {
    if(!channel || !channel.guild) return true;
    const permissions = channel.permissionsFor(channel.guild.members.me);
    return permissions.has(PermissionsBitField.Flags.ViewChannel) && permissions.has(PermissionsBitField.Flags.SendMessages) && permissions.has(PermissionsBitField.Flags.EmbedLinks);
}

const fetchChannel = async (channelId) => {
    try {
        return await client.channels.fetch(channelId);
    } catch(e) {
        return null;
    }
}

const getChannelGuildId = async (channelId) => {
    if(client.shard) {
        const f = client => {
            const channel = client.channels.get(channelId);
            if(channel) return channel.guildId;
        };
        const results = await client.shard.broadcastEval(f);
        return results.find(result => result);
    } else {
        const channel = client.channels.cache.get(channelId);
        return channel && channel.guildId;
    }
}

const valNamesToDiscordNames = (names) => {
    const obj = {};
    console.log(Object.entries(names));
    for(const [valLang, name] of Object.entries(names)) {        
        if(valToDiscLang[valLang]) obj[valToDiscLang[valLang]] = name;
    }
    return obj;
}

const canEditInteraction = (interaction) => Date.now() - interaction.createdTimestamp < 14.8 * 60 * 1000;

const discordTag = id => {
    const user = client.users.cache.get(id);
    return user ? `${user.username}#${user.discriminator}` : id;
}

// misc utils

const wait = ms => new Promise(r => setTimeout(r, ms));

const promiseTimeout = async (promise, ms, valueIfTimeout=null) => {
    return await Promise.race([promise, wait(ms).then(() => valueIfTimeout)]);
}

const isToday = (timestamp) => isSameDay(timestamp, Date.now());
const isSameDay = (t1, t2) => {
    t1 = new Date(t1); t2 = new Date(t2);
    return t1.getUTCFullYear() === t2.getUTCFullYear() && t1.getUTCMonth() === t2.getUTCMonth() && t1.getUTCDate() === t2.getUTCDate();
}

const ensureUsersFolder = () => {
    if(!fs.existsSync("src/data")) fs.mkdirSync("src/data");
    if(!fs.existsSync("src/data/users")) fs.mkdirSync("src/data/users");
}

const findKeyOfValue = (obj, value) => Object.keys(obj).find(key => obj[key] === value);

/** JSON format:
 * {
 *     accounts: [User objects],
 *     currentAccount: currently selected account, 1 for first account,
 *     settings: dictionary
 * }
 */

const readUserJson = (id) => {
    try {
        return JSON.parse(fs.readFileSync("src/data/users/" + id + ".json", "utf-8"));
    } catch(e) {
        return null;
    }
}

const getUserJson = (id, account=null) => {
    const user = readUserJson(id);
    if(!user) return null;

    if(!user.accounts) {
        const userJson =  {
            accounts: [user],
            currentAccount: 1,
            settings: defaultSettings
        }
        saveUserJson(id, userJson);
        return userJson.accounts[account || 1];
    }

    account = account || user.currentAccount || 1;
    if(account > user.accounts.length) account = 1;
    return user.accounts[account - 1];
}

const saveUserJson = (id, json) => {
    ensureUsersFolder();
    fs.writeFileSync("src/data/users/" + id + ".json", JSON.stringify(json, null, 2));
}

const saveUser = (user, account=null) => {
    if(!fs.existsSync("src/data/users")) fs.mkdirSync("src/data/users");

    const userJson = readUserJson(user.id);
    if(!userJson) {
        const objectToWrite = {
            accounts: [user],
            currentAccount: 1,
            settings: defaultSettings
        }
        saveUserJson(user.id, objectToWrite);
    } else {
        if(!account) account = userJson.accounts.findIndex(a => a.puuid === user.puuid) + 1 || userJson.currentAccount;
        if(account > userJson.accounts.length) account = userJson.accounts.length;

        userJson.accounts[(account || userJson.currentAccount) - 1] = user;
        saveUserJson(user.id, userJson);
    }
}

const addUser = (user) => {
    const userJson = readUserJson(user.id);
    if(userJson) {
        // check for duplicate accounts
        let foundDuplicate = false;
        for(let i = 0; i < userJson.accounts.length; i++) {
            if(userJson.accounts[i].puuid === user.puuid) {
                const oldUser = userJson.accounts[i];

                // merge the accounts
                userJson.accounts[i] = user;
                userJson.currentAccount = i + 1;

                // copy over data from old account
                user.alerts = removeDupeAlerts(oldUser.alerts.concat(userJson.accounts[i].alerts));
                user.lastFetchedData = oldUser.lastFetchedData;
                user.lastNoticeSeen = oldUser.lastNoticeSeen;
                user.lastSawEasterEgg = oldUser.lastSawEasterEgg;

                foundDuplicate = true;
            }
        }

        if(!foundDuplicate) {
            userJson.accounts.push(user);
            userJson.currentAccount = userJson.accounts.length;
        }

        saveUserJson(user.id, userJson);
    } else {
        const objectToWrite = {
            accounts: [user],
            currentAccount: 1,
            settings: defaultSettings
        }
        saveUserJson(user.id, objectToWrite);
    }
}

const deleteUser = (id, accountNumber) => {
    const userJson = readUserJson(id);
    if(!userJson) return;

    const indexToDelete = (accountNumber || userJson.currentAccount) - 1;
    const userToDelete = userJson.accounts[indexToDelete];

    userJson.accounts.splice(indexToDelete, 1);
    if(userJson.accounts.length === 0) fs.unlinkSync("src/data/users/" + id + ".json");
    else if(userJson.currentAccount > userJson.accounts.length) userJson.currentAccount = userJson.accounts.length;

    saveUserJson(id, userJson);

    return userToDelete.username;
}

const deleteWholeUser = (id) => {
    if(!fs.existsSync("src/data/users")) return;

    // get the user's PUUIDs to delete the shop cache
    const data = readUserJson(id);
    if(data) {
        const puuids = data.accounts.map(a => a.puuid);
        for(const puuid of puuids) {
            try {
                fs.unlinkSync(`src/data/shopCache/${puuid}.json`);
            } catch(e) {}
        }
    }

    fs.unlinkSync("src/data/users/" + id + ".json");
}

const getNumberOfAccounts = (id) => {
    const user = readUserJson(id);
    if(!user) return 0;
    return user.accounts.length;
}

const switchAccount = (id, accountNumber) => {
    const userJson = readUserJson(id);
    if(!userJson) return;
    userJson.currentAccount = accountNumber;
    saveUserJson(id, userJson);
    return userJson.accounts[accountNumber - 1];
}

const getAccountWithPuuid = (id, puuid) => {
    const userJson = readUserJson(id);
    if(!userJson) return null;
    return userJson.accounts.find(a => a.puuid === puuid);
}

const findTargetAccountIndex = (id, query) => {
    const userJson = readUserJson(id);
    if(!userJson) return null;

    let index = userJson.accounts.findIndex(a => a.username === query || a.puuid === query);
    if(index !== -1) return index + 1;

    return parseInt(query) || null;
}

const removeDupeAccounts = (id, json=readUserJson(id)) => {
    const accounts = json.accounts;
    const newAccounts = [];
    for(let i = 0; i < accounts.length; i++) {
        const existingAccount = newAccounts.find(a => a.puuid === accounts[i].puuid);
        if(!existingAccount) newAccounts.push(accounts[i]);
        else existingAccount.alerts = removeDupeAlerts(existingAccount.alerts.concat(accounts[i].alerts));
    }

    if(accounts.length !== newAccounts.length) {
        json.accounts = newAccounts;
        saveUserJson(id, json);
    }

    return json;
}

class User {
    constructor({id, puuid, auth, alerts=[], username, region, authFailures, lastFetchedData, lastNoticeSeen, lastSawEasterEgg}) {
        this.id = id;
        this.puuid = puuid;
        this.auth = auth;
        this.alerts = alerts || [];
        this.username = username;
        this.region = region;
        this.authFailures = authFailures || 0;
        this.lastFetchedData = lastFetchedData || 0;
        this.lastNoticeSeen =  lastNoticeSeen || "";
        this.lastSawEasterEgg = lastSawEasterEgg || 0;
    }
}

const transferUserDataFromOldUsersJson = () => {
    if(!fs.existsSync("src/data/users.json")) return;
    if(client.shard && client.shard.ids[0] !== 0) return;

    console.log("Transferring user data from users.json to the new format...");
    console.log("(The users.json file will be backed up as users.json.old, just in case)");

    const usersJson = JSON.parse(fs.readFileSync("src/data/users.json", "utf-8"));

    const alertsArray = fs.existsSync("src/data/alerts.json") ? JSON.parse(fs.readFileSync("src/data/alerts.json", "utf-8")) : [];
    const alertsForUser = (id) => alertsArray.filter(a => a.id === id);

    for(const id in usersJson) {
        const userData = usersJson[id];
        const user = new User({
            id: id,
            puuid: userData.puuid,
            auth: {
                rso: userData.rso,
                idt: userData.idt,
                ent: userData.ent,
                cookies: userData.cookies,
            },
            alerts: alertsForUser(id).map(alert => {return {uuid: alert.uuid, channel_id: alert.channel_id}}),
            username: userData.username,
            region: userData.region
        });
        saveUser(user);
    }
    fs.renameSync("src/data/users.json", "src/data/users.json.old");
}

const getUser = (id, account=null) => {
    if(id instanceof User) {
        const user = id;
        const userJson = readUserJson(user.id);
        if(!userJson) return null;

        const userData = userJson.accounts.find(a => a.puuid === user.puuid);
        return userData && new User(userData);
    }

    try {
        const userData = getUserJson(id, account);
        return userData && new User(userData);
    } catch(e) {
        return null;
    }
}

const userFilenameRegex = /\d+\.json/
const getUserList = () => {
    ensureUsersFolder();
    return fs.readdirSync("src/data/users").filter(filename => userFilenameRegex.test(filename)).map(filename => filename.replace(".json", ""));
}

const authUser = async (id, account=null) => {
    // doesn't check if token is valid, only checks it hasn't expired
    const user = getUser(id, account);
    if(!user || !user.auth || !user.auth.rso) return {success: false};

    const rsoExpiry = tokenExpiry(user.auth.rso);
    if(rsoExpiry - Date.now() > 10_000) return {success: true};

    return await refreshToken(id, account);
}

const redeemUsernamePassword = async (id, login, password) => {

    let rateLimit = isRateLimited("auth.riotgames.com");
    if(rateLimit) return {success: false, rateLimit: rateLimit};

    const proxyManager = getProxyManager();
    const proxy = await proxyManager.getProxy("auth.riotgames.com");
    const agent = await proxy?.createAgent("auth.riotgames.com");

    // prepare cookies for auth request
    const req1 = await fetch("https://auth.riotgames.com/api/v1/authorization", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'user-agent': await getUserAgent()
        },
        body: JSON.stringify({
            "client_id": "riot-client",
            "code_challenge": "",
            "code_challenge_method": "",
            "acr_values": "",
            "claims": "",
            "nonce": "69420",
            "redirect_uri": "http://localhost/redirect",
            "response_type": "token id_token",
            "scope": "openid link ban lol_region"
        }),
        proxy: agent
    });
    console.assert(req1.statusCode === 200, `Auth Request Cookies status code is ${req1.statusCode}!`, req1);

    rateLimit = checkRateLimit(req1, "auth.riotgames.com");
    if(rateLimit) return {success: false, rateLimit: rateLimit};

    let cookies = parseSetCookie(req1.headers["set-cookie"]);

    // get access token
    const req2 = await fetch("https://auth.riotgames.com/api/v1/authorization", {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            'user-agent': await getUserAgent(),
            'cookie': stringifyCookies(cookies)
        },
        body: JSON.stringify({
            'type': 'auth',
            'username': login,
            'password': password,
            'remember': true
        }),
        proxy: agent
    });
    console.assert(req2.statusCode === 200, `Auth status code is ${req2.statusCode}!`, req2);

    rateLimit = checkRateLimit(req2, "auth.riotgames.com")
    if(rateLimit) return {success: false, rateLimit: rateLimit};

    cookies = {
        ...cookies,
        ...parseSetCookie(req2.headers['set-cookie'])
    };

    const json2 = JSON.parse(req2.body);
    if(json2.type === 'error') {
        if(json2.error === "auth_failure") console.error("Authentication failure!", json2);
        else console.error("Unknown auth error!", JSON.stringify(json2, null, 2));
        return {success: false};
    }

    if(json2.type === 'response') {
        const user = await processAuthResponse(id, {login, password, cookies}, json2.response.parameters.uri);
        addUser(user);
        return {success: true};
    } else if(json2.type === 'multifactor') { // 2FA
        const user = new User({id});
        user.auth = {
            ...user.auth,
            waiting2FA: Date.now(),
            cookies: cookies
        }

        if(client.config.VALORANT.storePasswords) {
            user.auth.login = login;
            user.auth.password = btoa(password);
        }

        addUser(user);
        return {success: false, mfa: true, method: json2.multifactor.method, email: json2.multifactor.email};
    }

    return {success: false};
}

const redeem2FACode = async (id, code) => {
    let rateLimit = isRateLimited("auth.riotgames.com");
    if(rateLimit) return {success: false, rateLimit: rateLimit};

    let user = getUser(id);

    const req = await fetch("https://auth.riotgames.com/api/v1/authorization", {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            'user-agent': await getUserAgent(),
            'cookie': stringifyCookies(user.auth.cookies)
        },
        body: JSON.stringify({
            'type': 'multifactor',
            'code': code.toString(),
            'rememberDevice': true
        })
    });
    console.assert(req.statusCode === 200, `2FA status code is ${req.statusCode}!`, req);

    rateLimit = checkRateLimit(req, "auth.riotgames.com")
    if(rateLimit) return {success: false, rateLimit: rateLimit};

    deleteUser(id);

    user.auth = {
        ...user.auth,
        cookies: {
            ...user.auth.cookies,
            ...parseSetCookie(req.headers['set-cookie'])
        }
    };

    const json = JSON.parse(req.body);
    if(json.error === "multifactor_attempt_failed" || json.type === "error") {
        console.error("Authentication failure!", json);
        return {success: false};
    }

    user = await processAuthResponse(id, {login: user.auth.login, password: atob(user.auth.password || ""), cookies: user.auth.cookies}, json.response.parameters.uri, user);

    delete user.auth.waiting2FA;
    addUser(user);

    return {success: true};
}

const processAuthResponse = async (id, authData, redirect, user=null) => {
    if(!user) user = new User({id});
    const [rso, idt] = extractTokensFromUri(redirect);
    user.auth = {
        ...user.auth,
        rso: rso,
        idt: idt,
    }

    // save either cookies or login/password
    if(authData.login && client.config.VALORANT.storePasswords && !user.auth.waiting2FA) { // don't store login/password for people with 2FA
        user.auth.login = authData.login;
        user.auth.password = btoa(authData.password);
        delete user.auth.cookies;
    } else {
        user.auth.cookies = authData.cookies;
        delete user.auth.login; delete user.auth.password;
    }

    user.puuid = decodeToken(rso).sub;

    const existingAccount = getAccountWithPuuid(id, user.puuid);
    if(existingAccount) {
        user.username = existingAccount.username;
        user.region = existingAccount.region;
        if(existingAccount.auth) user.auth.ent = existingAccount.auth.ent;
    }

    // get username
    const userInfo = await getUserInfo(user);
    user.username = userInfo.username;

    // get entitlements token
    if(!user.auth.ent) user.auth.ent = await getEntitlementsAuth(user);

    // get region
    if(!user.region) user.region = await getRegion(user);

    user.lastFetchedData = Date.now();

    user.authFailures = 0;
    return user;
}

const getUserInfo = async (user) => {
    const req = await fetch("https://auth.riotgames.com/userinfo", {
        headers: {
            'Authorization': "Bearer " + user.auth.rso
        }
    });
    console.assert(req.statusCode === 200, `User info status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    if(json.acct) return {
        puuid: json.sub,
        username: json.acct.game_name && json.acct.game_name + "#" + json.acct.tag_line
    }
}

const getEntitlementsAuth = async (user) => {
    const req = await fetch("https://entitlements.auth.riotgames.com/api/token/v1", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer " + user.auth.rso
        }
    });
    console.assert(req.statusCode === 200, `Auth status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    return json.entitlements_token;
}

const getRegion = async (user) => {
    const req = await fetch("https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant", {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer " + user.auth.rso
        },
        body: JSON.stringify({
            'id_token': user.auth.idt,
        })
    });
    console.assert(req.statusCode === 200, `PAS token status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    return json.affinities.live;
}

const redeemCookies = async (id, cookies) => {
    let rateLimit = isRateLimited("auth.riotgames.com");
    if(rateLimit) return {success: false, rateLimit: rateLimit};

    const req = await fetch("https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&scope=account%20openid&nonce=1", {
        headers: {
            'user-agent': await getUserAgent(),
            cookie: cookies
        }
    });
    console.assert(req.statusCode === 303, `Cookie Reauth status code is ${req.statusCode}!`, req);

    rateLimit = checkRateLimit(req, "auth.riotgames.com");
    if(rateLimit) return {success: false, rateLimit: rateLimit};

    if(req.headers.location.startsWith("/login")) return {success: false}; // invalid cookies

    cookies = {
        ...parseSetCookie(cookies),
        ...parseSetCookie(req.headers['set-cookie'])
    }

    const user = await processAuthResponse(id, {cookies}, req.headers.location);
    addUser(user);

    return {success: true};
}

const refreshToken = async (id, account=null) => {
    let response = {success: false}

    let user = getUser(id, account);
    if(!user) return response;

    if(user.auth.cookies) {
        response = await queueCookiesLogin(id, stringifyCookies(user.auth.cookies));
        if(response.inQueue) response = await waitForAuthQueueResponse(response);
    }
    if(!response.success && user.auth.login && user.auth.password) {
        response = await queueUsernamePasswordLogin(id, user.auth.login, atob(user.auth.password));
        if(response.inQueue) response = await waitForAuthQueueResponse(response);
    }

    if(!response.success && !response.mfa && !response.rateLimit) deleteUserAuth(user);

    return response;
}

let riotClientVersion;
let userAgentFetchPromise;
const fetchRiotClientVersion = async (attempt=1) => {
    if(userAgentFetchPromise) return userAgentFetchPromise;

    let resolve;
    if(!userAgentFetchPromise) {
        client.logger.debug("Fetching latest Riot user-agent..."); // only log it the first time
        userAgentFetchPromise = new Promise(r => resolve = r);
    }

    const headers = {
        "User-Agent": "giorgi-o/skinpeek",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    if(client.config.VALORANT.githubToken) headers["Authorization"] = `Bearer ${client.config.VALORANT.githubToken}`;

    const githubReq = await fetch("https://api.github.com/repos/Morilli/riot-manifests/contents/Riot%20Client/KeystoneFoundationLiveWin?ref=master", {
        headers
    });

    let json, versions, error = false;
    try {
        if(githubReq.statusCode !== 200) error = true;
        else {
            json = JSON.parse(githubReq.body);
            versions = json.map(file => file.name.split('_')[0]);
        }
    } catch(e) {
        error = true
    }

    if(error) {
        if(attempt === 3) {
            console.error("Failed to fetch latest Riot user-agent! (tried 3 times)");

            const fallbackVersion = "65.0.2.5073401";
            console.error(`Using version number ${fallbackVersion} instead...`);
        }

        console.error(`Failed to fetch latest Riot user-agent! (try ${attempt}/3`);
        console.error(githubReq);

        await wait(1000);
        return fetchRiotClientVersion(attempt + 1);
    }

    const compareVersions = (a, b) => {
        const aSplit = a.split(".");
        const bSplit = b.split(".");
        for(let i = 0; i < aSplit.length; i++) {
            if(aSplit[i] > bSplit[i]) return 1;
            if(aSplit[i] < bSplit[i]) return -1;
        }
        return 0;
    }
    versions.sort((a, b) => compareVersions(b, a));

    riotClientVersion = versions[0];
    userAgentFetchPromise = null;
    resolve?.();
}

const getUserAgent = async () => {
    if(!riotClientVersion) await fetchRiotClientVersion();
    return `RiotClient/${riotClientVersion}.1234567 rso-auth (Windows;10;;Professional, x64)`;
}

const deleteUserAuth = (user) => {
    user.auth = null;
    saveUser(user);
}

const Operations = {
    USERNAME_PASSWORD: "up",
    MFA: "mf",
    COOKIES: "ck",
    NULL: "00"
}

const queue = [];
const queueResults = [];
let queueCounter = 1;
let processingCount = 0;

let authQueueInterval;
let lastQueueProcess = 0; // timestamp

const startAuthQueue = () => {
    clearInterval(authQueueInterval);
    if(client.config.VALORANT.useLoginQueue) authQueueInterval = setInterval(processAuthQueue, client.config.VALORANT.loginQueueInterval);
}

const queueUsernamePasswordLogin = async (id, username, password) => {
    if(!client.config.VALORANT.useLoginQueue) return await redeemUsernamePassword(id, username, password);
    if(useMultiqueue()) return await mqLoginUsernamePass(id, username, password);

    const c = queueCounter++;
    queue.push({
        operation: Operations.USERNAME_PASSWORD,
        c, id, username, password,
    });
    console.log(`Added Username+Password login to auth queue for user ${id} (c=${c})`);

    if(processingCount === 0) await processAuthQueue();
    return {inQueue: true, c};
}

const queue2FACodeRedeem = async (id, code) => {
    if(!client.config.VALORANT.useLoginQueue) return await redeem2FACode(id, code);
    if(useMultiqueue()) return {inQueue: false, ...await mqLogin2fa(id, code)};

    const c = queueCounter++;
    queue.push({ // should 2FA redeems be given priority?
        operation: Operations.MFA,
        c, id, code
    });
    console.log(`Added 2fa code redeem to auth queue for user ${id} (c=${c})`);

    if(processingCount === 0) await processAuthQueue();
    return {inQueue: true, c};
}

const queueCookiesLogin = async (id, cookies) => {
    if(!client.config.VALORANT.useLoginQueue) return await redeemCookies(id, cookies);
    if(useMultiqueue()) return {inQueue: false, ...await mqLoginCookies(id, cookies)};

    const c = queueCounter++;
    queue.push({
        operation: Operations.COOKIES,
        c, id, cookies
    });
    console.log(`Added cookie login to auth queue for user ${id} (c=${c})`);

    if(processingCount === 0) await processAuthQueue();
    return {inQueue: true, c};
}

const queueNullOperation = async (timeout) => {  // used for stress-testing the auth queue
    if(!client.config.VALORANT.useLoginQueue) await wait(timeout);
    if(useMultiqueue()) return {inQueue: false, ...await mqNullOperation(timeout)}

    const c = queueCounter++;
    queue.push({
        operation: Operations.NULL,
        c, timeout
    });
    console.log(`Added null operation to auth queue with timeout ${timeout} (c=${c})`);

    if(processingCount === 0) await processAuthQueue();
    return {inQueue: true, c};
}

const processAuthQueue = async () => {
    lastQueueProcess = Date.now();
    if(!client.config.VALORANT.useLoginQueue || !queue.length) return;
    if(useMultiqueue()) return;

    const item = queue.shift();
    console.log(`Processing auth queue item "${item.operation}" for ${item.id} (c=${item.c}, left=${queue.length})`);
    processingCount++;

    let result;
    try {
        switch (item.operation) {
            case Operations.USERNAME_PASSWORD:
                result = await redeemUsernamePassword(item.id, item.username, item.password);
                break;
            case Operations.MFA:
                result = await redeem2FACode(item.id, item.code);
                break;
            case Operations.COOKIES:
                result = await redeemCookies(item.id, item.cookies);
                break;
            case Operations.NULL:
                await wait(item.timeout);
                result = {success: true};
                break;
        }
    } catch(e) {
        result = {success: false, error: e};
    }

    queueResults.push({
        c: item.c,
        result
    });

    console.log(`Finished processing auth queue item "${item.operation}" for ${item.id} (c=${item.c})`);
    processingCount--;
}

const getAuthQueueItemStatus = async (c) => {
    if(useMultiqueue()) return await mqGetAuthQueueItemStatus(c);

    // check if in queue
    let item = queue.find(i => i.c === c);
    if(item) return {processed: false, ...remainingAndEstimatedTimestamp(c)};

    // check if currenty processing
    const index = queueResults.findIndex(i => i.c === c);
    if(index === -1) return {processed: false, remaining: 0};

    // get result
    item = queueResults[index];
    queueResults.splice(index, 1);
    return {processed: true, result: item.result};
}

const remainingAndEstimatedTimestamp = (c) => {
    const remaining = c - queue[0].c;
    let timestamp = lastQueueProcess + ((remaining + 1) * client.config.VALORANT.loginQueueInterval);

    // UX: if the timestamp is late, even by half a second, the user gets impatient.
    // on the other hand, if it happens early, the user is happy.
    timestamp += 2000;
    timestamp = Math.round(timestamp / 1000);

    return {remaining, timestamp};
}

const AVERAGE_UNRATED_XP_CONSTANT = 4200;
const SPIKERUSH_XP_CONSTANT = 1000;
const LEVEL_MULTIPLIER = 750;

const getWeeklies = async () => {
    console.log("Fetching mission data...");

    const req = await fetch("https://valorant-api.com/v1/missions");
    console.assert(req.statusCode === 200, `Valorant mission status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant mission data status code is ${json.status}!`, json);

    const now = Date.now();
    let weeklyData = {};
    json["data"].forEach(mission => {
        if (mission.type === "EAresMissionType::Weekly" && new Date(mission.expirationDate) > now) {
            if (!weeklyData[mission.activationDate]) {
                weeklyData[mission.activationDate] = {}
            }
            weeklyData[mission.activationDate][mission.uuid] = {
                title: mission.title,
                xpGrant: mission.xpGrant,
                progressToComplete: mission.progressToComplete,
                activationDate: mission.activationDate
            }
        }
    });
    return weeklyData;
}

const calculate_level_xp = async (level) => {
    if(level >= 2 && level <= 50) {
        return 2000 + (level - 2) * LEVEL_MULTIPLIER;
    } else if(level >= 51 && level <= 55) {
        return 36500
    } else {
        return 0
    }
}

const getNextReward = async (interaction, CurrentTier) => {
    if(CurrentTier === 55) return {
        tier: 56,
        rewardName: s(interaction).battlepass.FINISHED
    };

    const battlepassInfo = await getBattlepassInfo();
    const chapters = battlepassInfo.chapters.flatMap(chapter => chapter.levels) // only premium items
    const nextTier = chapters[CurrentTier];

    const rewardType = nextTier.reward.type;
    const rewardUUID = nextTier.reward.uuid;
    const xpAmount = nextTier.xp;

    switch(rewardType) {
        case "EquippableSkinLevel": {
            const skin = await getSkin(rewardUUID);
            return {
                tier: CurrentTier + 1,
                rewardName: l(skin.names, interaction),
                rewardIcon: skin.icon,
                rewardType: rewardType,
                XP: xpAmount
            };
        }
        case "EquippableCharmLevel": {
            const buddy = await getBuddy(rewardUUID)
            return {
                tier: CurrentTier + 1,
                rewardName: l(buddy.names, interaction),
                rewardIcon: buddy.icon,
                rewardType: rewardType,
                XP: xpAmount
            };
        }
        case "Currency":
            // Always 10 Radianite, no UUID and req needed, return Image Link and "Radianite"
            return {
                tier: CurrentTier + 1,
                rewardName: s(interaction).info.RADIANITE,
                rewardIcon: 'https://media.valorant-api.com/currencies/e59aa87c-4cbf-517a-5983-6e81511be9b7/displayicon.png',
                rewardType: rewardType,
                XP: xpAmount
            };
        case "PlayerCard": {
            const card = await getCard(rewardUUID);
            return {
                tier: CurrentTier + 1,
                rewardName: l(card.names, interaction),
                rewardIcon: card.icons.small,
                rewardType: rewardType,
                XP: xpAmount
            };
        }
        case "Spray": {
            const spray = await getSpray(rewardUUID);
            return {
                tier: CurrentTier + 1,
                rewardName: l(spray.names, interaction),
                rewardIcon: spray.icon,
                rewardType: rewardType,
                XP: xpAmount
            };
        }
    }
}


const getBattlepassProgress = async (interaction, maxlevel) => {
    const id = interaction.user.id;
    const authSuccess = await authUser(id);
    if (!authSuccess.success)
        return authSuccess;

    const user = getUser(id);
    console.log(`Fetching battlepass progress for ${user.username}...`);

    // https://github.com/techchrism/valorant-api-docs/blob/trunk/docs/Contracts/GET%20Contracts_Fetch.md
    const req = await fetch(`https://pd.${userRegion(user)}.a.pvp.net/contracts/v1/contracts/${user.puuid}`, {
        headers: {
            "Authorization": "Bearer " + user.auth.rso,
            "X-Riot-Entitlements-JWT": user.auth.ent,
            "X-Riot-ClientVersion": (await getValorantVersion()).riotClientVersion
        }
    });

    console.assert(req.statusCode === 200, `Valorant battlepass code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    if (json.httpStatus === 400 && json.errorCode === "BAD_CLAIMS") {
        deleteUserAuth(user);
        return { success: false };
    } else if (isMaintenance(json))
        return { success: false, maintenance: true };

    const battlepassInfo = await getBattlepassInfo();
    const contract = json.Contracts.find(contract => contract.ContractDefinitionID === battlepassInfo.uuid);

    const contractData = {
        progressionLevelReached: contract.ProgressionLevelReached,
        progressionTowardsNextLevel: contract.ProgressionTowardsNextLevel,
        totalProgressionEarned: contract.ContractProgression.TotalProgressionEarned,
        missions: {
            missionArray: json.Missions,
            weeklyCheckpoint: json.MissionMetadata.WeeklyCheckpoint
        }
    }

    const weeklyxp = await getWeeklyXP(contractData.missions);
    const battlepassPurchased = await getBattlepassPurchase(id);

    if(battlepassPurchased.success === false) // login failed
        return battlepassPurchased;

    // Calculate
    const season_end = new Date(battlepassInfo.end);
    const season_now = Date.now();
    const season_left = Math.abs(season_end - season_now);
    const season_days_left = Math.floor(season_left / (1000 * 60 * 60 * 24)); // 1000 * 60 * 60 * 24 is one day in milliseconds
    const season_weeks_left = season_days_left / 7;

    let totalxp = contractData.totalProgressionEarned;
    let totalxpneeded = 0;
    for (let i = 1; i <= maxlevel; i++) {
        totalxpneeded = totalxpneeded + await calculate_level_xp(i);
    }

    totalxpneeded = totalxpneeded - totalxp;

    let spikerush_xp = SPIKERUSH_XP_CONSTANT
    let average_unrated_xp = AVERAGE_UNRATED_XP_CONSTANT
    if (battlepassPurchased) {
        spikerush_xp = spikerush_xp * 1.03;
        average_unrated_xp = average_unrated_xp * 1.03;
    }

    return {
        success: true,
        bpdata: contractData,
        battlepassPurchased: battlepassPurchased,
        nextReward: await getNextReward(interaction, contractData.progressionLevelReached),
        season_days_left: season_days_left,
        totalxp: totalxp.toLocaleString(),
        xpneeded: (await calculate_level_xp(contractData.progressionLevelReached + 1) - contractData.progressionTowardsNextLevel).toLocaleString(),
        totalxpneeded: Math.max(0, totalxpneeded).toLocaleString(),
        weeklyxp: weeklyxp.toLocaleString(),
        spikerushneeded: Math.max(0, Math.ceil(totalxpneeded / spikerush_xp)).toLocaleString(),
        normalneeded: Math.max(0, Math.ceil(totalxpneeded / average_unrated_xp)).toLocaleString(),
        spikerushneededwithweeklies: Math.max(0, Math.ceil((totalxpneeded - weeklyxp) / spikerush_xp)).toLocaleString(),
        normalneededwithweeklies: Math.max(0, Math.ceil((totalxpneeded - weeklyxp) / average_unrated_xp)).toLocaleString(),
        dailyxpneeded: Math.max(0, Math.ceil(totalxpneeded / season_days_left)).toLocaleString(),
        weeklyxpneeded: Math.max(0, Math.ceil(totalxpneeded / season_weeks_left)).toLocaleString(),
        dailyxpneededwithweeklies: Math.max(0, Math.ceil((totalxpneeded - weeklyxp) / season_days_left)).toLocaleString(),
        weeklyxpneededwithweeklies: Math.max(0, Math.ceil((totalxpneeded - weeklyxp) / season_weeks_left)).toLocaleString()
    };
};

const getWeeklyXP = async (userMissionsObj) => {
    const seasonWeeklyMissions = await getWeeklies();
    let xp = 0

    // Check if user has not completed every weekly and add xp from that
    if (userMissionsObj.missionArray.length > 2) {
        userMissionsObj.missionArray.forEach(userMission => {
            if (!userMission.Complete) {
                Object.entries(seasonWeeklyMissions).forEach(([date, weeklyMissions]) => {
                    Object.entries(weeklyMissions).forEach(([uuid, missionDetails]) => {
                        if (uuid === userMission.ID) {
                            xp = xp + missionDetails.xpGrant;
                            userMissionsObj.weeklyCheckpoint = missionDetails.activationDate; // update checkpoint to prevent adding this weeks XP later on
                        }
                    });
                });
            }
        });
    }

    // Add XP from future weeklies
    Object.entries(seasonWeeklyMissions).forEach(([date, weeklyMission]) => {
        if (new Date(date) > new Date(userMissionsObj.weeklyCheckpoint))  {
            Object.entries(weeklyMission).forEach(([uuid, missionDetails]) => {
                xp = xp + missionDetails.xpGrant;
            });
       }
    });

    return xp
}

const getBattlepassPurchase = async (id) => {
    const authSuccess = await authUser(id);
    if (!authSuccess.success)
        return authSuccess;

    const user = getUser(id);
    console.log(`Fetching battlepass purchases for ${user.username}...`);

    const data = await getEntitlements(user, "f85cb6f7-33e5-4dc8-b609-ec7212301948", "battlepass");
    if(!data.success) return false;

    const battlepassInfo = await getBattlepassInfo();

    for (let entitlement of data.entitlements.Entitlements) {
        if (entitlement.ItemID === battlepassInfo.uuid) {
            return true;
        }
    }

    return false;
}

const renderBattlepassProgress = async (interaction) => {
    const maxlevel = interaction.options && interaction.options.getInteger("maxlevel") || 50;
    const battlepassProgress = await getBattlepassProgress(interaction, maxlevel);

    return await renderBattlepass(battlepassProgress, maxlevel, interaction);
}

const formatVersion = 12;
let gameVersion;

let weapons, skins, rarities, buddies, sprays, cards, titles, bundles, battlepass;
let prices = {timestamp: null};

const clearCache = () => {
    weapons = skins = rarities = buddies = sprays = cards = titles = bundles = battlepass = null;
    prices = {timestamp: null};
}

const getValorantVersion = async () => {
    client.logger.debug("Fetching current valorant version...");

    const req = await fetch("https://valorant-api.com/v1/version");
    console.assert(req.statusCode === 200, `Valorant version status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant version data status code is ${json.status}!`, json);

    return json.data;
}

const loadSkinsJSON = async (filename="src/data/skins.json") => {
    const jsonData = await asyncReadJSONFile(filename).catch(() => {});
    if(!jsonData || jsonData.formatVersion !== formatVersion) return;

    weapons = jsonData.weapons;
    skins = jsonData.skins;
    prices = jsonData.prices;
    rarities = jsonData.rarities;
    bundles = jsonData.bundles;
    buddies = jsonData.buddies;
    sprays = jsonData.sprays;
    cards = jsonData.cards;
    titles = jsonData.titles;
    battlepass = jsonData.battlepass;
}

const saveSkinsJSON = (filename="src/data/skins.json") => {
    fs.writeFileSync(filename, JSON.stringify({formatVersion, gameVersion, weapons, skins, prices, bundles, rarities, buddies, sprays, cards, titles, battlepass}, null, 2));
}

const fetchData = async (types=null, checkVersion=false) => {
    try {
        if(checkVersion || !gameVersion) {
            gameVersion = (await getValorantVersion()).manifestId;
            await loadSkinsJSON();
        }

        if(types === null) types = [skins, prices, bundles, rarities, buddies, cards, sprays, titles, battlepass];

        const promises = [];

        if(types.includes(skins) && (!skins || skins.version !== gameVersion)) promises.push(getSkinList(gameVersion));
        if(types.includes(prices) && (!prices || prices.version !== gameVersion)) promises.push(getPrices(gameVersion));
        if(types.includes(bundles) && (!bundles || bundles.version !== gameVersion)) promises.push(getBundleList(gameVersion));
        if(types.includes(rarities) && (!rarities || rarities.version !== gameVersion)) promises.push(getRarities(gameVersion));
        if(types.includes(buddies) && (!buddies || buddies.version !== gameVersion)) promises.push(getBuddies(gameVersion));
        if(types.includes(cards) && (!cards || cards.version !== gameVersion)) promises.push(getCards(gameVersion));
        if(types.includes(sprays) && (!sprays || sprays.version !== gameVersion)) promises.push(getSprays(gameVersion));
        if(types.includes(titles) && (!titles || titles.version !== gameVersion)) promises.push(getTitles(gameVersion));
        if(types.includes(battlepass) && (!battlepass || battlepass.version !== gameVersion)) promises.push(fetchBattlepassInfo(gameVersion));

        if(!prices || Date.now() - prices.timestamp > 24 * 60 * 60 * 1000) promises.push(getPrices(gameVersion)); // refresh prices every 24h

        if(promises.length === 0) return;
        await Promise.all(promises);

        saveSkinsJSON();

        // we fetched the skins, tell other shards to load them
        if(client.shard) sendShardMessage({type: "skinsReload"});
    } catch(e) {
        console.error("There was an error while trying to fetch skin data!");
        console.error(e);
    }
}

const getSkinList = async (gameVersion) => {
    console.log("Fetching valorant skin list...");

    const req = await fetch("https://valorant-api.com/v1/weapons?language=all");
    console.assert(req.statusCode === 200, `Valorant skins status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant skins data status code is ${json.status}!`, json);

    skins = {version: gameVersion};
    weapons = {};
    for(const weapon of json.data) {
        weapons[weapon.uuid] = {
            uuid: weapon.uuid,
            names: weapon.displayName,
            icon: weapon.displayIcon,
            defaultSkinUuid: weapon.defaultSkinUuid,
        }
        for(const skin of weapon.skins) {
            const levelOne = skin.levels[0];

            let icon;
            if (skin.themeUuid === "5a629df4-4765-0214-bd40-fbb96542941f") { // default skins
                icon = skin.chromas[0] && skin.chromas[0].fullRender;
            } else {
                for (let i = 0; i < skin.levels.length; i++) {
                    if (skin.levels[i] && skin.levels[i].displayIcon) {
                        icon = skin.levels[i].displayIcon;
                        break;
                    }
                }
            }
            if(!icon) icon = null;
            skins[levelOne.uuid] = {
                uuid: levelOne.uuid,
                skinUuid: skin.uuid,
                weapon: weapon.uuid,
                names: skin.displayName,
                icon: icon,
                rarity: skin.contentTierUuid,
                defaultSkinUuid: weapon.defaultSkinUuid,
                levels: skin.levels,
                chromas: skin.chromas,
            }
        }
    }

    saveSkinsJSON();
}

const getPrices = async (gameVersion, id=null) => {
    if(!client.config.VALORANT.fetchSkinPrices) return;

    // if no ID is passed, try with all users
    if(id === null) {
        for(const id of getUserList()) {
            const user = getUser(id);
            if(!user || !user.auth) continue;

            const success = await getPrices(gameVersion, id);
            if(success) return true;
        }
        return false;
    }

    let user = getUser(id);
    if(!user) return false;

    const authSuccess = await authUser(id);
    if(!authSuccess.success || !user.auth.rso || !user.auth.ent || !user.region) return false;

    user = getUser(id);
    console.log(`Fetching skin prices using ${user.username}'s access token...`);

    // https://github.com/techchrism/valorant-api-docs/blob/trunk/docs/Store/GET%20Store_GetOffers.md
    const req = await fetch(`https://pd.${userRegion(user)}.a.pvp.net/store/v1/offers/`, {
        headers: {
            "Authorization": "Bearer " + user.auth.rso,
            "X-Riot-Entitlements-JWT": user.auth.ent
        }
    });
    console.assert(req.statusCode === 200, `Valorant skins prices code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    if(json.httpStatus === 400 && json.errorCode === "BAD_CLAIMS") {
        return false; // user rso is invalid, should we delete the user as well?
    } else if(isMaintenance(json)) return false;

    prices = {version: gameVersion};
    for(const offer of json.Offers) {
        prices[offer.OfferID] = offer.Cost[Object.keys(offer.Cost)[0]];
    }

    prices.timestamp = Date.now();

    saveSkinsJSON();

    return true;
}

const getBundleList = async (gameVersion) => {
    console.log("Fetching valorant bundle list...");

    const req = await fetch("https://valorant-api.com/v1/bundles?language=all");
    console.assert(req.statusCode === 200, `Valorant bundles status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant bundles data status code is ${json.status}!`, json);

    bundles = {version: gameVersion};
    for(const bundle of json.data) {
        bundles[bundle.uuid] = {
            uuid: bundle.uuid,
            names: bundle.displayName,
            subNames: bundle.displayNameSubText,
            descriptions: bundle.extraDescription,
            icon: bundle.displayIcon2,
            items: null,
            price: null,
            basePrice: null,
            expires: null,
            last_seen: null
        }
    }

    // get bundle items from https://docs.valtracker.gg/bundles
    const req2 = await fetch("https://api.valtracker.gg/v1/bundles");
    console.assert(req2.statusCode === 200, `ValTracker bundles items status code is ${req.statusCode}!`, req);

    const json2 = JSON.parse(req2.body);
    console.assert(json.status === 200, `ValTracker bundles items data status code is ${json.status}!`, json);

    for(const bundleData of json2.data) {
        if(bundles[bundleData.uuid]) {
            const bundle = bundles[bundleData.uuid];
            const items = [];
            const defaultItemData = {
                amount: 1,
                discount: 0
            }

            for(const weapon of bundleData.weapons)
                items.push({
                    uuid: weapon.levels[0].uuid,
                    type: itemTypes.SKIN,
                    price: weapon.price,
                    ...defaultItemData
                });
            for(const buddy of bundleData.buddies)
                items.push({
                    uuid: buddy.levels[0].uuid,
                    type: itemTypes.BUDDY,
                    price: buddy.price,
                    ...defaultItemData
                });
            for(const card of bundleData.cards)
                items.push({
                    uuid: card.uuid,
                    type: itemTypes.CARD,
                    price: card.price,
                    ...defaultItemData
                });
            for(const spray of bundleData.sprays)
                items.push({
                    uuid: spray.uuid,
                    type: itemTypes.SPRAY,
                    price: spray.price,
                    ...defaultItemData
                });

            bundle.items = items;
            bundle.last_seen = bundleData.last_seen
            bundle.price = bundleData.price;
        }
    }

    saveSkinsJSON();
}

const addBundleData = async (bundleData) => {
    await fetchData([bundles]);

    const bundle = bundles[bundleData.uuid];
    if(bundle) {
        bundle.items = bundleData.items.map(item => {
            return {
                uuid: item.uuid,
                type: item.type,
                price: item.price,
                basePrice: item.basePrice,
                discount: item.discount,
                amount: item.amount
            }
        });
        bundle.price = bundleData.price;
        bundle.basePrice = bundleData.basePrice;
        bundle.expires = bundleData.expires;

        saveSkinsJSON();
    }
}

const getRarities = async (gameVersion) => {
    if(!client.config.VALORANT.fetchSkinRarities) return false;

    console.log("Fetching skin rarities list...");

    const req = await fetch("https://valorant-api.com/v1/contenttiers/");
    console.assert(req.statusCode === 200, `Valorant rarities status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant rarities data status code is ${json.status}!`, json);

    rarities = {version: gameVersion};
    for(const rarity of json.data) {
        rarities[rarity.uuid] = {
            uuid: rarity.uuid,
            name: rarity.devName,
            icon: rarity.displayIcon
        }
    }

    saveSkinsJSON();

    return true;
}

const getBuddies = async (gameVersion) => {
    console.log("Fetching gun buddies list...");

    const req = await fetch("https://valorant-api.com/v1/buddies?language=all");
    console.assert(req.statusCode === 200, `Valorant buddies status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant buddies data status code is ${json.status}!`, json);

    buddies = {version: gameVersion};
    for(const buddy of json.data) {
        const levelOne = buddy.levels[0];
        buddies[levelOne.uuid] = {
            uuid: levelOne.uuid,
            names: buddy.displayName,
            icon: levelOne.displayIcon
        }
    }

    saveSkinsJSON();
}

const getCards = async (gameVersion) => {
    console.log("Fetching player cards list...");

    const req = await fetch("https://valorant-api.com/v1/playercards?language=all");
    console.assert(req.statusCode === 200, `Valorant cards status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant cards data status code is ${json.status}!`, json);

    cards = {version: gameVersion};
    for(const card of json.data) {
        cards[card.uuid] = {
            uuid: card.uuid,
            names: card.displayName,
            icons: {
                small: card.smallArt,
                wide: card.wideArt,
                large: card.largeArt
            }
        }
    }

    saveSkinsJSON();
}

const getSprays = async (gameVersion) => {
    console.log("Fetching sprays list...");

    const req = await fetch("https://valorant-api.com/v1/sprays?language=all");
    console.assert(req.statusCode === 200, `Valorant sprays status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant sprays data status code is ${json.status}!`, json);

    sprays = {version: gameVersion};
    for(const spray of json.data) {
        sprays[spray.uuid] = {
            uuid: spray.uuid,
            names: spray.displayName,
            icon: spray.fullTransparentIcon || spray.displayIcon
        }
    }

    saveSkinsJSON();
}

const getTitles = async (gameVersion) => {
    console.log("Fetching player titles list...");

    const req = await fetch("https://valorant-api.com/v1/playertitles?language=all");
    console.assert(req.statusCode === 200, `Valorant titles status code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    console.assert(json.status === 200, `Valorant titles data status code is ${json.status}!`, json);

    titles = {version: gameVersion};
    for(const title of json.data) {
        titles[title.uuid] = {
            uuid: title.uuid,
            names: title.displayName,
            text: title.titleText
        }
    }

    saveSkinsJSON();
}

const fetchBattlepassInfo = async (gameVersion) => {
    console.log("Fetching battlepass UUID and end date...");

    // current season & end date
    const req1 = await fetch("https://valorant-api.com/v1/seasons");
    console.assert(req1.statusCode === 200, `Valorant seasons status code is ${req1.statusCode}!`, req1);

    const json1 = JSON.parse(req1.body);
    console.assert(json1.status === 200, `Valorant seasons data status code is ${json1.status}!`, json1);

    // battlepass uuid
    const req2 = await fetch("https://valorant-api.com/v1/contracts");
    console.assert(req2.statusCode === 200, `Valorant contracts status code is ${req2.statusCode}!`, req2);

    const json2 = JSON.parse(req2.body);
    console.assert(json2.status === 200, `Valorant contracts data status code is ${json2.status}!`, json2);

    // find current season
    const now = Date.now();
    const currentSeason = json1.data.find(season => season.type === "EAresSeasonType::Act" && new Date(season.startTime) < now && new Date(season.endTime) > now);

    // find current battlepass
    const currentBattlepass = json2.data.find(contract => contract.content.relationUuid === currentSeason.uuid);

    // save data
    battlepass = {
        version: gameVersion,
        uuid: currentBattlepass.uuid,
        end: currentSeason.endTime,
        chapters: currentBattlepass.content.chapters
    }

    saveSkinsJSON();
}

const getItem = async (uuid, type) =>  {
    switch(type) {
        case itemTypes.SKIN: return await getSkin(uuid);
        case itemTypes.BUDDY: return await getBuddy(uuid);
        case itemTypes.CARD: return await getCard(uuid);
        case itemTypes.SPRAY: return await getSpray(uuid);
        case itemTypes.TITLE: return await getTitle(uuid);
    }
}

const getSkin = async (uuid, reloadData=true) => {
    if(reloadData) await fetchData([skins, prices]);

    let skin = skins[uuid];
    if(!skin) return null;

    skin.price = await getPrice(uuid);

    return skin;
}

const getSkinFromSkinUuid = async (uuid, reloadData=true) => {
    if(reloadData) await fetchData([skins, prices]);

    let skin = Object.values(skins).find(skin => skin.skinUuid === uuid);
    if(!skin) return null;

    skin.price = await getPrice(skin.uuid);

    return skin;
}

const getWeapon = async (uuid) => {
    await fetchData([skins]);

    return weapons[uuid] || null;
}

const getPrice = async (uuid) => {
    if(!prices) await fetchData([prices]);

    if(prices[uuid]) return prices[uuid];

    if(!bundles) await fetchData([bundles]); // todo rewrite this part
    const bundle = Object.values(bundles).find(bundle => bundle.items?.find(item => item.uuid === uuid));
    if(bundle) {
        const bundleItem = bundle.items.find(item => item.uuid === uuid);
        return bundleItem.price || null;
    }

    return null;

}

const getRarity = async (uuid) => {
    if(!rarities) await fetchData([rarities]);
    if(rarities) return rarities[uuid] || null;
}

const getAllSkins = async () => {
    return await Promise.all(Object.values(skins).filter(o => typeof o === "object").map(skin => getSkin(skin.uuid, false)));
}

const searchSkin = async (query, locale, limit=20, threshold=-5000) => {
    await fetchData([skins, prices]);

    const valLocale = discToValLang[locale];
    const keys = [`names.${valLocale}`];
    if(valLocale !== DEFAULT_VALORANT_LANG) keys.push(`names.${DEFAULT_VALORANT_LANG}`);

    const allSkins = await getAllSkins()
    return fuzzysort.go(query, allSkins, {
        keys: keys,
        limit: limit,
        threshold: threshold,
        all: true
    });
}

const getBundle = async (uuid) => {
    await fetchData([bundles]);
    return bundles[uuid];
}

const getAllBundles = () => {
    // reverse the array so that the older bundles are first
    return Object.values(bundles).reverse().filter(o => typeof o === "object")
}

const searchBundle = async (query, locale, limit=20, threshold=-1000) => {
    await fetchData([bundles]);

    const valLocale = discToValLang[locale];
    const keys = [`names.${valLocale}`];
    if(valLocale !== DEFAULT_VALORANT_LANG) keys.push(`names.${DEFAULT_VALORANT_LANG}`);

    return fuzzysort.go(query, getAllBundles(), {
        keys: keys,
        limit: limit,
        threshold: threshold,
        all: true
    });
}

const getBuddy = async (uuid) => {
    if(!buddies) await fetchData([buddies]);
    return buddies[uuid];
}

const getSpray = async (uuid) => {
    if(!sprays) await fetchData([sprays]);
    return sprays[uuid];
}

const getCard = async (uuid) => {
    if(!cards) await fetchData([cards]);
    return cards[uuid];
}

const getTitle = async (uuid) => {
    if(!titles) await fetchData([titles]);
    return titles[uuid];
}

const getBattlepassInfo = async () => {
    if(!battlepass) await fetchData([battlepass]);
    return battlepass;
}

const getEntitlements = async (user, itemTypeId, itemType="item") => {
    // https://valapidocs.techchrism.me/endpoint/owned-items
    const req = await fetch(`https://pd.${userRegion(user)}.a.pvp.net/store/v1/entitlements/${user.puuid}/${itemTypeId}`, {
        headers: {
            "Authorization": "Bearer " + user.auth.rso,
            "X-Riot-Entitlements-JWT": user.auth.ent
        }
    });

    console.assert(req.statusCode === 200, `Valorant ${itemType} entitlements code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    if (json.httpStatus === 400 && json.errorCode === "BAD_CLAIMS") {
        deleteUserAuth(user);
        return { success: false };
    } else if (isMaintenance(json))
        return { success: false, maintenance: true };

    return {
        success: true,
        entitlements: json
    }

}

const skinCache = {};

const getSkins = async (user) => {
    // get all the owned skins of a user
    if(user.puuid in skinCache) {
        const cached = skinCache[user.puuid];
        const expiresIn = cached.timestamp - Date.now() + client.config.VALORANT.loadoutCacheExpiration;
        if(expiresIn <= 0) {
            delete skinCache[user.puuid];
        } else {
            console.log(`Fetched skins collection from cache for user ${user.username}! It expires in ${Math.ceil(expiresIn / 1000)}s.`);
            return {success: true, skins: cached.skins};
        }
    }


    if(!user.auth) throw "You got logged out! Please /login again.";

    const data = await getEntitlements(user, "e7c63390-eda7-46e0-bb7a-a6abdacd2433", "skins");
    if(!data.success) return data;

    const skins = data.entitlements.Entitlements.map(ent => ent.ItemID);

    skinCache[user.puuid] = {
        skins: skins,
        timestamp: Date.now()
    }

    console.log(`Fetched skins collection for ${user.username}`);

    return {
        success: true,
        skins: skins
    }
}


const loadoutCache = {};

const getLoadout = async (user, account) => {
    // get the currently equipped skins of a user
    if(user.puuid in loadoutCache) {
        const cached = loadoutCache[user.puuid];
        const expiresIn = cached.timestamp - Date.now() + client.config.VALORANT.loadoutCacheExpiration;
        if(expiresIn <= 0) {
            delete loadoutCache[user.puuid];
        } else {
            console.log(`Fetched loadout from cache for user ${user.username}! It expires in ${Math.ceil(expiresIn / 1000)}s.`);
            return {success: true, loadout: cached.loadout, favorites: cached.favorites};
        }
    }

    const authResult = await authUser(user.id, account);
    if(!authResult.success) return authResult;

    user = getUser(user.id, account);
    console.log(`Fetching loadout for ${user.username}...`);

    const req = await fetch(`https://pd.${userRegion(user)}.a.pvp.net/personalization/v2/players/${user.puuid}/playerloadout`, {
        headers: {
            "Authorization": "Bearer " + user.auth.rso,
            "X-Riot-Entitlements-JWT": user.auth.ent
        }
    });

    console.assert(req.statusCode === 200, `Valorant loadout fetch code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    if (json.httpStatus === 400 && json.errorCode === "BAD_CLAIMS") {
        deleteUserAuth(user);
        return { success: false };
    } else if (isMaintenance(json))
        return { success: false, maintenance: true };

    const req2 = await fetch(`https://pd.${userRegion(user)}.a.pvp.net/favorites/v1/players/${user.puuid}/favorites`, {
        headers: {
            "Authorization": "Bearer " + user.auth.rso,
            "X-Riot-Entitlements-JWT": user.auth.ent
        }
    });

    console.assert(req.statusCode === 200, `Valorant favorites fetch code is ${req.statusCode}!`, req);

    const json2 = JSON.parse(req2.body);
    if (json2.httpStatus === 400 && json2.errorCode === "BAD_CLAIMS") {
        deleteUserAuth(user);
        return { success: false };
    } else if (isMaintenance(json2))
        return { success: false, maintenance: true };

    loadoutCache[user.puuid] = {
        loadout: json,
        favorites: json2,
        timestamp: Date.now()
    }

    console.log(`Fetched loadout for ${user.username}`);

    return {
        success: true,
        loadout: json,
        favorites: json2
    }
}

const renderCollection = async (interaction, targetId=interaction.user.id, weaponName=null) => {
    const user = getUser(targetId);
    if(!user) return await interaction.followUp({embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)]});

    if(weaponName) return await renderCollectionOfWeapon(interaction, targetId, weaponName);

    const loadout = await getLoadout(user);
    if (!loadout.success) return errorFetchingCollection(loadout, interaction, targetId);

    return await skinCollectionSingleEmbed(interaction, targetId, user, loadout);
}

const renderCollectionOfWeapon = async (interaction, targetId, weaponName) => {
    const user = getUser(targetId);
    const skins = await getSkins(user);
    if(!skins.success) return errorFetchingCollection(skins, interaction, targetId);

    return await collectionOfWeaponEmbed(interaction, targetId, user, WeaponTypeUuid[weaponName], skins.skins)
}

const errorFetchingCollection = (result, interaction, targetId) => {
    if(!result.success) {
        let errorText;
        if(targetId && targetId !== interaction.user.id) errorText = s(interaction).error.AUTH_ERROR_COLLECTION_OTHER.f({u: `<@${targetId}>`});
        else errorText = s(interaction).error.AUTH_ERROR_COLLECTION;

        return authFailureMessage(interaction, result, errorText);
    }
}

const getShop = async (id, account=null) => {
    if(useMultiqueue()) return await mqGetShop(id, account);

    const authSuccess = await authUser(id, account);
    if(!authSuccess.success) return authSuccess;

    const user = getUser(id, account);
    client.logger.debug(`Fetching shop for ${user.username}...`);

    // https://github.com/techchrism/valorant-api-docs/blob/trunk/docs/Store/GET%20Store_GetStorefrontV2.md
    const req = await fetch(`https://pd.${userRegion(user)}.a.pvp.net/store/v2/storefront/${user.puuid}`, {
        headers: {
            "Authorization": "Bearer " + user.auth.rso,
            "X-Riot-Entitlements-JWT": user.auth.ent,

            // fix for HTTP 400 (thx Zxc and Manuel_Hexe)
            "X-Riot-ClientPlatform": "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9",
            "X-Riot-ClientVersion": "release-08.07-shipping-9-2444158",
        }
    });
    console.assert(req.statusCode === 200, `Valorant skins offers code is ${req.statusCode}!`, req);


    const json = JSON.parse(req.body);
    if(json.httpStatus === 400 && json.errorCode === "BAD_CLAIMS") {
        deleteUserAuth(user);
        return {success: false}
    } else if(isMaintenance(json)) return {success: false, maintenance: true};

    // shop stats tracking
    try {
        addStore(user.puuid, json.SkinsPanelLayout.SingleItemOffers);
    } catch(e) {
        console.error("Error adding shop stats!");
        console.error(e);
        console.error(json);
    }

    // add to shop cache
    addShopCache(user.puuid, json);

    // save bundle data & prices
    Promise.all(json.FeaturedBundle.Bundles.map(rawBundle => formatBundle(rawBundle))).then(async bundles => {
        for(const bundle of bundles)
            await addBundleData(bundle);
    });

    return {success: true, shop: json};
}

const getOffers = async (id, account=null) => {
    const shopCache = getShopCache(getPuuid(id, account), "offers");
    if(shopCache) return {success: true, cached: true, ...shopCache.offers};

    const resp = await getShop(id, account);
    if(!resp.success) return resp;

    return await easterEggOffers(id, account, {
        success: true,
        offers: resp.shop.SkinsPanelLayout.SingleItemOffers,
        expires: Math.floor(Date.now() / 1000) + resp.shop.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds,
        accessory: {
            offers: (resp.shop.AccessoryStore.AccessoryStoreOffers || []).map(rawAccessory => {
                return {
                    cost: rawAccessory.Offer.Cost["85ca954a-41f2-ce94-9b45-8ca3dd39a00d"],
                    rewards: rawAccessory.Offer.Rewards,
                    contractID: rawAccessory.ContractID
                }
            }),
            expires: Math.floor(Date.now() / 1000) + resp.shop.AccessoryStore.AccessoryStoreRemainingDurationInSeconds
        }
    });
}

const getBundles = async (id, account=null) => {
    const shopCache = getShopCache(getPuuid(id, account), "bundles");
    if(shopCache) return {success: true, bundles: shopCache.bundles};

    const resp = await getShop(id, account);
    if(!resp.success) return resp;

    const formatted = await Promise.all(resp.shop.FeaturedBundle.Bundles.map(rawBundle => formatBundle(rawBundle)));

    return {success: true, bundles: formatted};
}

const getNightMarket = async (id, account=null) => {
    const shopCache = getShopCache(getPuuid(id, account), "night_market");
    if(shopCache) return {success: true, ...shopCache.night_market};

    const resp = await getShop(id, account);
    if(!resp.success) return resp;

    if(!resp.shop.BonusStore) return {
        success: true,
        offers: false
    }

    return {success: true, ...formatNightMarket(resp.shop.BonusStore)};
}

const getBalance = async (id, account=null) => {
    const authSuccess = await authUser(id, account);
    if(!authSuccess.success) return authSuccess;

    const user = getUser(id, account);
    console.log(`Fetching balance for ${user.username}...`);

    // https://github.com/techchrism/valorant-api-docs/blob/trunk/docs/Store/GET%20Store_GetWallet.md
    const req = await fetch(`https://pd.${userRegion(user)}.a.pvp.net/store/v1/wallet/${user.puuid}`, {
        headers: {
            "Authorization": "Bearer " + user.auth.rso,
            "X-Riot-Entitlements-JWT": user.auth.ent
        }
    });
    console.assert(req.statusCode === 200, `Valorant balance code is ${req.statusCode}!`, req);

    const json = JSON.parse(req.body);
    if(json.httpStatus === 400 && json.errorCode === "BAD_CLAIMS") {
        deleteUser(id, account);
        return {success: false};
    } else if(isMaintenance(json)) return {success: false, maintenance: true};

    return {
        success: true,
        vp: json.Balances["85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741"],
        rad: json.Balances["e59aa87c-4cbf-517a-5983-6e81511be9b7"],
        kc: json.Balances["85ca954a-41f2-ce94-9b45-8ca3dd39a00d"]
    };
}

let nextNMTimestamp = null, nextNMTimestampUpdated = 0;
const getNextNightMarketTimestamp = async () => {
    // only fetch every 5 minutes
    if(nextNMTimestampUpdated > Date.now() - 5 * 60 * 1000) return nextNMTimestamp;

    // thx Mistral for maintaining this!
    const req = await fetch("https://gist.githubusercontent.com/blongnh/17bb10db4bb77df5530024bcb0385042/raw/nmdate.txt");

    const [timestamp] = req.body.split("\n");
    nextNMTimestamp = parseInt(timestamp);
    if(isNaN(nextNMTimestamp) || nextNMTimestamp < Date.now() / 1000) nextNMTimestamp = null;

    nextNMTimestampUpdated = Date.now();
    return nextNMTimestamp;
}

/** Shop cache format:
 * {
 *     offers: {
 *         offers: [...],
 *         expires: timestamp,
 *         accessory: {
 *              offers: [{
 *                  "cost": 4000,
 *                  "rewards": [{
 *                      "ItemTypeID": uuid,
 *                      "ItemID": uuid,
 *                      "Quantity": number
 *                      }],
 *                  "contractID": uuid
 *                  },...],
 *              expires: timestamp
 *          }
 *     },
 *     bundles: [{
 *         uuid: uuid,
 *         expires: timestamp
 *     }, {...}],
 *     night_market?: {
 *         offers: [{
 *             uuid: uuid,
 *             realPrice: 5000,
 *             nmPrice: 1000,
 *             percent: 80
 *         }, {...}],
 *         expires: timestamp
 *     },
 *     timestamp: timestamp
 * }
 */

const getShopCache = (puuid, target="offers", print=true) => {
    if(!client.config.VALORANT.useShopCache) return null;

    try {
        const shopCache = JSON.parse(fs.readFileSync("src/data/shopCache/" + puuid + ".json", "utf8"));

        let expiresTimestamp;
        if(target === "offers") expiresTimestamp = shopCache[target].expires;
        else if(target === "night_market") expiresTimestamp = shopCache[target] ? shopCache[target].expires : getMidnightTimestamp(shopCache.timestamp);
        else if(target === "bundles") expiresTimestamp = Math.min(...shopCache.bundles.map(bundle => bundle.expires), get9PMTimetstamp(Date.now()));
        else if(target === "all") expiresTimestamp = Math.min(shopCache.offers.expires, ...shopCache.bundles.map(bundle => bundle.expires), get9PMTimetstamp(Date.now()), shopCache.night_market.expires);
        else console.error("Invalid target for shop cache! " + target);

        if(Date.now() / 1000 > expiresTimestamp) return null;

        if(print) console.log(`Fetched shop cache for user ${discordTag(puuid)}`);

        if(!shopCache.offers.accessory) return null;// If there are no accessories in the cache, it returns null so that the user's shop is checked again.

        return shopCache;
    } catch(e) {}
    return null;
}

const addShopCache = (puuid, shopJson) => {
    if(!client.config.VALORANT.useShopCache) return;

    const now = Date.now();
    const shopCache = {
        offers: {
            offers: shopJson.SkinsPanelLayout.SingleItemOffers,
            expires: Math.floor(now / 1000) + shopJson.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds,
            accessory: {
                offers: (shopJson.AccessoryStore.AccessoryStoreOffers || []).map(rawAccessory => {
                    return {
                        cost: rawAccessory.Offer.Cost["85ca954a-41f2-ce94-9b45-8ca3dd39a00d"],
                        rewards: rawAccessory.Offer.Rewards,
                        contractID: rawAccessory.ContractID
                    }
                }),
                expires: Math.floor(now / 1000) + shopJson.AccessoryStore.AccessoryStoreRemainingDurationInSeconds
            }
        },
        bundles: shopJson.FeaturedBundle.Bundles.map(rawBundle => {
            return {
                uuid: rawBundle.DataAssetID,
                expires: Math.floor(now / 1000) + rawBundle.DurationRemainingInSeconds,
            }
        }),
        night_market: formatNightMarket(shopJson.BonusStore),
        timestamp: now
    }

    if(!fs.existsSync("src/data/shopCache")) fs.mkdirSync("src/data/shopCache");
    fs.writeFileSync("src/data/shopCache/" + puuid + ".json", JSON.stringify(shopCache, null, 2));

    client.logger.debug(`Added shop cache for user ${discordTag(puuid)}`);
}

const getMidnightTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999) / 1000;
}

const get9PMTimetstamp = (timestamp) => { // new bundles appear at 9PM UTC
    const date = new Date(timestamp);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 20, 59, 59, 999) / 1000;
}


const easterEggOffers = async (id, account, offers) => {
    // shhh...
    try {
        const _offers = {...offers, offers: [...offers.offers]};
        const user = getUser(id, account);

        const sawEasterEgg = isSameDay(user.lastSawEasterEgg, Date.now());
        const isApril1st = new Date().getMonth() === 3 && new Date().getDate() === 1;
        if (isApril1st && !sawEasterEgg) {

            for (const [i, uuid] of Object.entries(_offers.offers)) {
                const skin = await getSkin(uuid);
                const defaultSkin = await getSkinFromSkinUuid(skin.defaultSkinUuid);
                _offers.offers[i] = defaultSkin.uuid;
            }

            user.lastSawEasterEgg = Date.now();
            saveUser(user);
            return _offers
        }
    } catch (e) {
        console.error(e);
    }
    return offers;
}

const fetchShop = async (interaction, user, targetId=interaction.user.id, accessory = null) => {
    // fetch the channel if not in cache
    const channel = interaction.channel || await fetchChannel(interaction.channelId);

    // start uploading emoji now
    const emojiPromise = VPEmoji(interaction, channel);
    const KCEmojiPromise = KCEmoji(interaction, channel)

    let shop = await getOffers(targetId);
    if(shop.inQueue) shop = await waitForShopQueueResponse(shop);

    user = getUser(user);
    if(accessory === "daily" || !accessory) {
        return await renderOffers(shop, interaction, user, await emojiPromise, targetId)
    }else {
        return await renderAccessoryOffers(shop, interaction, user, await KCEmojiPromise)
    }
    
}

const fetchBundles = async (interaction) => {
    const channel = interaction.channel || await fetchChannel(interaction.channelId);
    const emojiPromise = VPEmoji(interaction, channel);

    let bundles = await getBundles(interaction.user.id);
    if(bundles.inQueue) bundles = await waitForShopQueueResponse(bundles);

    return await renderBundles(bundles, interaction, await emojiPromise);
}

const fetchNightMarket = async (interaction, user) => {
    const channel = interaction.channel || await fetchChannel(interaction.channelId);
    const emojiPromise = VPEmoji(interaction, channel);

    let market = await getNightMarket(interaction.user.id);
    if(market.inQueue) market = await waitForShopQueueResponse(market);

    return await renderNightMarket(market, interaction, user, await emojiPromise);
}

module.exports =
{
    readUserJson, getUserJson, saveUserJson, saveUser, addUser,
    deleteUser, deleteWholeUser, getNumberOfAccounts, switchAccount,
    getAccountWithPuuid, findTargetAccountIndex, removeDupeAccounts,
    User, transferUserDataFromOldUsersJson, getUser, getUserList, authUser, redeemUsernamePassword, 
    redeem2FACode, getUserInfo, getRegion, redeemCookies, refreshToken, fetchRiotClientVersion, deleteUserAuth,
    Operations, queueUsernamePasswordLogin, queue2FACodeRedeem, queueCookiesLogin, queueNullOperation,
    processAuthQueue, getAuthQueueItemStatus,
    getBattlepassProgress, renderBattlepassProgress,
    getValorantVersion, loadSkinsJSON, saveSkinsJSON, fetchData, getSkinList, 
    addBundleData, getBuddies, getCards, getSprays, getTitles, 
    fetchBattlepassInfo, getItem, getSkin, getSkinFromSkinUuid, getWeapon,
    getPrice, getRarity, getAllSkins, searchSkin, getBundle, getAllBundles,
    searchBundle, getBuddy, getSpray, getCard, getTitle, getBattlepassInfo,
    getEntitlements, getEntitlementsAuth, getSkins, getLoadout, renderCollection,
    getShop, getOffers, getBundles, getNightMarket, getBalance, getNextNightMarketTimestamp,
    getShopCache,
    fetchShop, fetchBundles, fetchNightMarket, //fetchRawShop, waitForShopQueueResponse,getShopQueueItemStatus, processShopQueue,
    queueNullOperation, //queueItemShop, queueNightMarket, queueBundles, queueShop,
    discToValLang, discLanguageNames, DEFAULT_LANG, DEFAULT_VALORANT_LANG,
    s, l, f, sendMQRequest, sendMQResponse, handleMQRequest, handleMQResponse,
    mqGetShop, mqLoginUsernamePass, mqLogin2fa, mqLoginCookies, useMultiqueue,
    checkRateLimit, isRateLimited,
    settings, getSetting, setSetting, registerInteractionLocale, handleSettingsViewCommand, 
    handleSettingsSetCommand, handleSettingDropdown, settingName, 
    settingIsVisible, humanifyValue, defaultSettings, areAllShardsReady, sendShardMessage,
    loadStats, calculateOverallStats, getOverallStats, getStatsFor,
    addStore,
    fetch, asyncReadFile, asyncReadJSONFile, itemTypes, parseSetCookie,
    stringifyCookies, extractTokensFromUri, decodeToken, tokenExpiry,
    userRegion, isMaintenance, formatBundle, fetchMaintenances, formatNightMarket,
    removeDupeAlerts, getPuuid, defer, skinNameAndEmoji, actionRow,
    removeAlertButton, removeAlertActionRow,
    retryAuthButton, externalEmojisAllowed, canCreateEmojis, emojiToString,
    canSendMessages, fetchChannel, getChannelGuildId, valNamesToDiscordNames,
    canEditInteraction, discordTag, wait, isToday, isSameDay, ensureUsersFolder,
    findKeyOfValue,
    addAlert, alertsForUser, alertExists, filteredAlertsForUser, alertsPerChannelPerGuild, 
    removeAlert, checkAlerts, sendAlert, sendCredentialsExpired, testAlerts,
    fetchAlerts,
    waitForAuthQueueResponse, loginUsernamePassword, login2FA, retryFailedOperation, cleanupFailedOperations,
    VAL_COLOR_1,VAL_COLOR_2,VAL_COLOR_3,
    authFailureMessage, skinChosenEmbed, renderOffers, renderBundles,
    renderBundle, renderNightMarket, renderBattlepass, skinCollectionSingleEmbed,
    skinCollectionPageEmbed, botInfoEmbed, ownerMessageEmbed, switchAccountButtons,
    alertsPageEmbed, alertTestResponse, allStatsEmbed, statsForSkinEmbed,
    accountsListEmbed, settingsEmbed, valMaintenancesEmbeds, valMaintenanceEmbed,
    basicEmbed, headerEmbed, secondaryEmbed,
    VPEmoji, RadEmoji, rarityEmoji, localLog, localError, loadLogger, addMessagesToLog, sendConsoleOutput,
    settingsChoices, scheduleTasks, destroyTasks, 
    mqNullOperation, mqGetAuthQueueItemStatus, clearCache, isDefaultSkin, sendDailyShop, saveClient, 
    activeWaitForAuthQueueResponse, WeaponType, WeaponTypeUuid, collectionOfWeaponEmbed, 
    // config, saveConfig, loadConfig
}