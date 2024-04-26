const {
    ApplicationCommandType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");

const {
    basicEmbed, s, canSendMessages, switchAccountButtons, switchAccount, getUser, getSkins,
    fetchShop, fetchNightMarket, renderBattlepassProgress, fetchAlerts, renderCollection, WeaponTypeUuid,
    collectionOfWeaponEmbed, getSetting, renderProfile, renderCompetitiveMatchHistory, getAccountInfo, fetchMatchHistory
} = require("@helpers/Valorant");


/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
    id: "account",
    description: "Switch Account button",
    type: ApplicationCommandType.User,
    category: "VALORANT",
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,
  
    async run(interaction) {
        const [, customId, id, accountIndex] = interaction.customId.split('/');

        if (id !== interaction.user.id && !getSetting(id, "othersCanUseAccountButtons")) return await interaction.reply({
            embeds: [basicEmbed(s(interaction).error.NOT_UR_MESSAGE_GENERIC)],
            ephemeral: true
        });

        if (!canSendMessages(interaction.channel)) return await interaction.reply({
            embeds: [basicEmbed(s(interaction).error.GENERIC_NO_PERMS)]
        });

        const channel = await interaction.client.channels.fetch(interaction.channelId);
        const message = await channel.messages.fetch(interaction.message.id);
        if (!message.components) message.components = switchAccountButtons(interaction, customId, true);

        for (const actionRow of message.components) {
            for (const component of actionRow.components) {
                if (component.data.custom_id === interaction.customId) {
                    component.data.label = `${s(interaction).info.LOADING}`;
                    component.data.style = ButtonStyle.Primary;
                    component.data.disabled = true;
                    component.data.emoji = { name: '⏳' };
                }
            }
        }

        await message.edit({
            embeds: message.embeds,
            components: message.components
        });
        if (accountIndex !== "accessory" && accountIndex !== "daily" && accountIndex !== "c") {
            const success = switchAccount(id, parseInt(accountIndex));
            if (!success) return await interaction.reply({
                embeds: [basicEmbed(s(interaction).error.ACCOUNT_NOT_FOUND)],
                ephemeral: true
            });
        }

        let newMessage;
        switch (customId) {
            case "shop": newMessage = await fetchShop(interaction, getUser(id), id, "daily"); break;
            case "accessoryshop": newMessage = await fetchShop(interaction, getUser(id), id, "accessory"); break;
            case "nm": newMessage = await fetchNightMarket(interaction, getUser(id)); break;
            case "bp": newMessage = await renderBattlepassProgress(interaction, id); break;
            case "alerts": newMessage = await fetchAlerts(interaction); break;
            case "cl": newMessage = await renderCollection(interaction, id); break;
            case "profile": newMessage = await renderProfile(interaction, await getAccountInfo(getUser(id)), id); break;
            case "comphistory": newMessage = await renderCompetitiveMatchHistory(interaction, await getAccountInfo(getUser(id)),await fetchMatchHistory(interaction, getUser(id), "competitive"), id); break;
        }
        /* else */ if (customId.startsWith("clw")) {
            let valorantUser = getUser(id);
            const [, weaponTypeIndex] = interaction.customId.split('/')[1].split('-');
            const weaponType = Object.values(WeaponTypeUuid)[parseInt(weaponTypeIndex)];
            newMessage = await collectionOfWeaponEmbed(interaction, id, valorantUser, weaponType, (await getSkins(valorantUser)).skins);
        }

        if (!newMessage.components) newMessage.components = switchAccountButtons(interaction, customId, true, false, id);


        await message.edit(newMessage);
    },
  };
  