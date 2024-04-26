const {
    ApplicationCommandType,
  } = require("discord.js");

const {
    getUser, s, getLoadout, authFailureMessage, skinCollectionPageEmbed, skinCollectionSingleEmbed
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "clswitch",
  description: "Collection switch",
  type: ApplicationCommandType.User,
  category: "VALORANT",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction) {
      const [, switchTo, id] = interaction.customId.split('/');
      const switchToPage = switchTo === "p";

      const valorantUser = getUser(interaction.user.id);

      let user;
      if (id !== interaction.user.id) user = getUser(id);
      else user = valorantUser;

      const loadoutResponse = await getLoadout(user);
      if (!loadoutResponse.success) return await interaction.reply(authFailureMessage(interaction, loadoutResponse, s(interaction).error.AUTH_ERROR_COLLECTION, id !== interaction.user.id));

      if (switchToPage) await interaction.update(await skinCollectionPageEmbed(interaction, id, user, loadoutResponse));
      else await interaction.update(await skinCollectionSingleEmbed(interaction, id, user, loadoutResponse));
    },
  };
  