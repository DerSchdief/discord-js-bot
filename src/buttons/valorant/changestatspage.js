const {
    ApplicationCommandType,
  } = require("discord.js");

const {
    basicEmbed, s, allStatsEmbed, getOverallStats
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "changestatspage",
  description: "Change Stats Page",
  type: ApplicationCommandType.User,
  category: "VALORANT",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
  async run(interaction) {
      const [, id, pageIndex] = interaction.customId.split('/');

      if (id !== interaction.user.id) return await interaction.reply({
          embeds: [basicEmbed(s(interaction).error.NOT_UR_MESSAGE_STATS)],
          ephemeral: true
      });

      await interaction.update(await allStatsEmbed(interaction, await getOverallStats(), parseInt(pageIndex)));
    },
  };
  