const { 
  ModalBuilder, ApplicationCommandType, TextInputStyle,
  ActionRowBuilder, TextInputBuilder
} = require("discord.js");
  
/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "play",
  description: "play",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction) {
      const playModal = new ModalBuilder()
			.setCustomId('playModal')
			.setTitle('Play')

      // & Modal Guide: https://discordjs.guide/interactions/modals.html#building-and-responding-with-modals

      const playInput = new TextInputBuilder()
          .setCustomId('playInput')
          .setLabel("Enter a YouTube URL or Music Name")
          .setStyle(TextInputStyle.Short) // & TextInputStyle Guide: https://discordjs.guide/interactions/modals.html#input-styles
          .setRequired(true);

      const playActionRow = new ActionRowBuilder().addComponents(playInput);

      playModal.addComponents(playActionRow);

      await interaction.showModal(playModal);
    },
  };
  