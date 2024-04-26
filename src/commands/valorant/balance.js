const {
    
  } = require("discord.js");

const {getUser, basicEmbed, s, fetchChannel, defer, VPEmoji, RadEmoji, getBalance, VAL_COLOR_1} = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "balance",
    description: "show how many VALORANT Points & Radianite you have in your account!",
    category: "VALORANT",
    // botPermissions: ["EmbedLinks"],
    // command: {
    //   enabled: true,
    //   usage: "[command]",
    // },
    slashCommand: {
      enabled: true,
      options: [],
    },
  

    async messageRun(message, args, data) {
        //nix
    }, 

    async interactionRun(interaction) {
        const valorantUser = getUser(interaction.user.id);

        if (!valorantUser) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
            ephemeral: true
        });

        const channel = interaction.channel || await fetchChannel(interaction.channelId);
        const VPEmojiPromise = VPEmoji(interaction, channel);
        const RadEmojiPromise = RadEmoji(interaction, channel);
        const KCEmojiPromise = KCEmoji(interaction, channel);

        const balance = await getBalance(interaction.user.id);

        if (!balance.success) return await interaction.followUp(authFailureMessage(interaction, balance, "**Could not fetch your balance**, most likely you got logged out. Try logging in again."));

        const theVPEmoji = await VPEmojiPromise;
        const theRadEmoji = await RadEmojiPromise || "";
        const theKCEmoji = await KCEmojiPromise || "";

        await interaction.followUp({
            embeds: [{ // move this to embed.js?
                title: s(interaction).info.WALLET_HEADER.f({ u: valorantUser.username }, interaction),
                color: VAL_COLOR_1,
                fields: [
                    { name: s(interaction).info.VPOINTS, value: `${theVPEmoji} ${balance.vp}`, inline: true },
                    { name: s(interaction).info.RADIANITE, value: `${theRadEmoji} ${balance.rad}`, inline: true },
                    { name: s(interaction).info.KCREDIT, value: `${theKCEmoji} ${balance.kc}`, inline: true }
                ]
            }]
        });
        interaction.client.logger.debug(`Sent ${interaction.user.tag}'s balance!`);
    }
  }