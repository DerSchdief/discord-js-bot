const {

  } = require("discord.js");

const {
        getUser, basicEmbed, s, authFailureMessage,
        defer, authUser, alertTestResponse, testAlerts
    } = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "testalerts",
    description: "Make sure alerts are working for your account and in this channel",
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

    async interactionRun(interaction, client) {
        const valorantUser = getUser(interaction.user.id);

        if(!valorantUser) return await interaction.followup({
            embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
            ephemeral: true
        });
ß
        const auth = await authUser(interaction.user.id);
        if(!auth.success) return await interaction.followUp(authFailureMessage(interaction, auth, s(interaction).error.AUTH_ERROR_ALERTS));

        const success = await testAlerts(interaction);

        await alertTestResponse(interaction, success);
    }
  }