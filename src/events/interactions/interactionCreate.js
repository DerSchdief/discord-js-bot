const { getSettings } = require("@schemas/Guild");
const { 
  commandHandler, contextHandler, statsHandler, suggestionHandler, 
  ticketHandler, buttonHandler,autocompleteHandler, selectMenuHandler,
  modalHandler
} = require("@src/handlers");
const { InteractionType } = require("discord.js");

/**
 * @param {import('@src/structures').BotClient} client
 * @param {import('discord.js').BaseInteraction} interaction
 */
module.exports = async (client, interaction) => {
  if (!interaction.guild) {
    return interaction
      .reply({ content: "Command can only be executed in a discord server", ephemeral: true })
      .catch(() => {});
  }

  // Slash Commands
  if (interaction.isChatInputCommand()) {
    await commandHandler.handleSlashCommand(interaction, client);
  }

  // Context Menu
  else if (interaction.isContextMenuCommand()) {
    const context = client.contextMenus.get(interaction.commandName);
    if (context) await contextHandler.handleContext(interaction, context);
    else return interaction.reply({ content: "An error has occurred", ephemeral: true }).catch(() => {});
  }

  else if (interaction.isAutocomplete()){
    await autocompleteHandler.handleAutocomplete(interaction);
  }

  else if (interaction.isStringSelectMenu()) {
    // const selectMenu = client.selectMenus.get(interaction.customId);
    await selectMenuHandler.handleSelectMenu(interaction)
  }

  // Buttons
  else if (interaction.isButton()) {
    await buttonHandler.handleButton(interaction);

    // switch (interaction.customId) {
    //   case "TICKET_CREATE":
    //     return ticketHandler.handleTicketOpen(interaction);

    //   case "TICKET_CLOSE":
    //     return ticketHandler.handleTicketClose(interaction);

    //   case "SUGGEST_APPROVE":
    //     return suggestionHandler.handleApproveBtn(interaction);

    //   case "SUGGEST_REJECT":
    //     return suggestionHandler.handleRejectBtn(interaction);

    //   case "SUGGEST_DELETE":
    //     return suggestionHandler.handleDeleteBtn(interaction);
    // }
  }

  // Modals
  else if (interaction.type === InteractionType.ModalSubmit) {
    await modalHandler.handleModal(interaction);
    // switch (interaction.customId) {
    //   case "SUGGEST_APPROVE_MODAL":
    //     return suggestionHandler.handleApproveModal(interaction);

    //   case "SUGGEST_REJECT_MODAL":
    //     return suggestionHandler.handleRejectModal(interaction);

    //   case "SUGGEST_DELETE_MODAL":
    //     return suggestionHandler.handleDeleteModal(interaction);
    //   case "playModal":
        
    // }
  }

  const settings = await getSettings(interaction.guild);

  // track stats
  if (settings.stats.enabled) statsHandler.trackInteractionStats(interaction).catch(() => {});
};
