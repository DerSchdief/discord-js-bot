const {
    
  } = require("discord.js");

const {getUser, basicEmbed, s, fetchAlerts, defer} = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "alerts",
  description: "Show all your active alerts!",
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

      const message = await fetchAlerts(interaction);
      await interaction.followUp(message);
    }
  }