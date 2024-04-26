const {
    ApplicationCommandType,
  } = require("discord.js");

const {
    getUser, s, getLoadout, authFailureMessage, skinCollectionPageEmbed
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "clpage",
  description: "Collection Page",
  type: ApplicationCommandType.User,
  category: "VALORANT",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction) {
        const [, id, pageIndex] = interaction.customId.split('/');

        const valorantUser = getUser(interaction.user.id);

        let user;
        if(id !== interaction.user.id) user = getUser(id);
        else user = valorantUser;

        const loadoutResponse = await getLoadout(user);
        if(!loadoutResponse.success) return await interaction.reply(authFailureMessage(interaction, loadoutResponse, s(interaction).error.AUTH_ERROR_COLLECTION, id !== interaction.user.id));

        await interaction.update(await skinCollectionPageEmbed(interaction, id, user, loadoutResponse, parseInt(pageIndex)));
    },
  };
  