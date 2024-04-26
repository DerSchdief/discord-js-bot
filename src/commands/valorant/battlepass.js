const {
  ApplicationCommandOptionType,
} = require("discord.js");

const {
      getUser, basicEmbed, s, renderBattlepassProgress, findTargetAccountIndex,
      switchAccount
  } = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "battlepass",
  description: "Calculate battlepass progression.",
  category: "VALORANT",
  // botPermissions: ["EmbedLinks"],
  // command: {
  //   enabled: true,
  //   usage: "[command]",
  // },
  slashCommand: {
    enabled: true,
    options: [
      {
        name: "skin",
        description: "The name of the skin you want to see the stats of",
        required: false,
        type: ApplicationCommandOptionType.String,
      },
    ],
  },

    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     * @returns 
     */

    async messageRun(message, args, data) {
      //nix
      }, 

    async interactionRun(interaction) {
      const valorantUser = getUser(interaction.user.id);

      if (!valorantUser) return await interaction.followUp({
        embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
        ephemeral: true
      });

      const message = await renderBattlepassProgress(interaction);
      await interaction.followUp(message);

      interaction.client.logger.debug(`Sent ${interaction.user.tag}'s battlepass!`);
    }
  }