const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ApplicationCommandType,
  } = require("discord.js");
  
  module.exports = {
    id: "search",
    description: "Shows Queue",
    type: ApplicationCommandType.User,
    category: "MUSIC",
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,
  
    async execute(interaction, client) {
        const searchModal = new ModalBuilder()
            .setCustomId('searchModal')
            .setTitle('Search')

        const searchInput = new TextInputBuilder()
            .setCustomId('searchInput')
            .setLabel("Enter a Music Name to search")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const searchActionRow = new ActionRowBuilder().addComponents(searchInput);

        searchModal.addComponents(searchActionRow);

        await interaction.showModal(searchModal);
    },
  };
  