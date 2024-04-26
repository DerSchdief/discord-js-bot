const {
    
  } = require("discord.js");

const {
        readUserJson, basicEmbed, s, accountsListEmbed
    } = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "accounts",
    description: "Show all of your Valorant accounts",
    category: "VALORANT",
    // botPermissions: ["EmbedLinks"],
    // command: {
    //   enabled: true,
    //   usage: "[command]",
    // },
    slashCommand: {
      enabled: true,
    },

    async messageRun(message, args, data) {
        //nix
    }, 

    async interactionRun(interaction) {
      const userJson = readUserJson(interaction.user.id);
      if (!userJson) return await interaction.followUp({
          embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
          ephemeral: true
      });

      await interaction.followUp(accountsListEmbed(interaction, userJson));
    }
  }