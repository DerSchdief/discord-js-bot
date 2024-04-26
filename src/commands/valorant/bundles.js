const {
  } = require("discord.js");

const {getUser, basicEmbed, s, fetchBundles, defer} = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "bundles",
  description: "Show the current featured bundle(s).",
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

        const message = await fetchBundles(interaction);
        await interaction.followUp(message);

        interaction.client.logger.debug(`Sent ${interaction.user.tag}'s bundle(s)!`);
    }
  }