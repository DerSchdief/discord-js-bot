const {
    ApplicationCommandType,
  } = require("discord.js");

const {
    retryFailedOperation
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "retry_auth",
  description: "Retry Authentication",
  type: ApplicationCommandType.User,
  category: "VALORANT",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction) {
        // await interaction.deferReply({ephemeral: true});
        const [, operationIndex] = interaction.customId.split('/');
        await retryFailedOperation(interaction, parseInt(operationIndex));
    },
  };
  