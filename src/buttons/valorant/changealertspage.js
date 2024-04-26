const {
    ApplicationCommandType,
  } = require("discord.js");

const {
    basicEmbed, s, VPEmoji, alertsPageEmbed, filteredAlertsForUser
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "changealertspage",
  description: "Change Alerts Page",
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
          embeds: [basicEmbed(s(interaction).error.NOT_UR_ALERT)],
          ephemeral: true
      });

      const emojiString = await VPEmoji(interaction);
      await interaction.update(await alertsPageEmbed(interaction, await filteredAlertsForUser(interaction), parseInt(pageIndex), emojiString));
    },
  };
  