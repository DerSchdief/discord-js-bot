const { 
  ModalBuilder, ApplicationCommandType, TextInputStyle,
  ActionRowBuilder, TextInputBuilder
} = require("discord.js");
  
/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "volume",
  description: "volume",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction) {
      const volumeModal = new ModalBuilder()
			.setCustomId('volumeModal')
			.setTitle('Volume')

      // & Modal Guide: https://discordjs.guide/interactions/modals.html#building-and-responding-with-modals

      const volumeInput = new TextInputBuilder()
          .setCustomId('volumeInput')
          .setLabel("Enter the Volume for the Bot")
          .setStyle(TextInputStyle.Short) // & TextInputStyle Guide: https://discordjs.guide/interactions/modals.html#input-styles
          .setRequired(false);

      const volumeActionRow = new ActionRowBuilder().addComponents(volumeInput);

      volumeModal.addComponents(volumeActionRow);

      await interaction.showModal(volumeModal);
    },
  };
  