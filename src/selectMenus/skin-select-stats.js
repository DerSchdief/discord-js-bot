const { ApplicationCommandType, } = require("discord.js");
const { basicEmbed, getSkin, getStatsFor, statsForSkinEmbed } = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseSelectMenu")}
*/
module.exports = {
  id: "skin-select-stats",
  description: "Select Skin Stats",
  type: ApplicationCommandType.User,
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    if(interaction.message.interaction.user.id !== interaction.user.id) {
      return await interaction.update({
          embeds: [basicEmbed(s(interaction).error.NOT_UR_MESSAGE_STATS)],
          ephemeral: true
      });
    }

    const chosenSkin = interaction.values[0].substr(5);
    const skin = await getSkin(chosenSkin);
    const stats = getStatsFor(chosenSkin);

    await interaction.message.edit({
        embeds: [await statsForSkinEmbed(skin, stats, interaction)],
        components: []
    });
  },
};
