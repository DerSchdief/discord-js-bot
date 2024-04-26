const {
      
  } = require("discord.js");

const {getUser, basicEmbed, s, fetchNightMarket, defer} = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "nightmarket",
  description: "Show your Night Market if there is one.",
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

      if (!valorantUser) return await interaction.followUp({
        embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
        ephemeral: true
      });

      const message = await fetchNightMarket(interaction, valorantUser);
      await interaction.followUp(message);

      interaction.client.logger.debug(`Sent ${interaction.user.tag}'s night market!`);
    }
  }