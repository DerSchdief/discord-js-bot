const {
    ApplicationCommandType,
  } = require("discord.js");

const {
    getUser, s, WeaponTypeUuid, authFailureMessage, collectionOfWeaponEmbed, getSkins
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "clwpage",
  description: "Collection Weapon Page",
  type: ApplicationCommandType.User,
  category: "VALORANT",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction, client) {
      const [, weaponTypeIndex, id, pageIndex] = interaction.customId.split('/');
      const weaponType = Object.values(WeaponTypeUuid)[parseInt(weaponTypeIndex)];

      const valorantUser = getUser(interaction.user.id);

      let user;
      if (id !== interaction.user.id) user = getUser(id);
      else user = valorantUser;

      const skinsResponse = await getSkins(user);
      if (!skinsResponse.success) return await interaction.reply(authFailureMessage(interaction, skinsResponse, s(interaction).error.AUTH_ERROR_COLLECTION, id !== interaction.user.id));

      await interaction.update(await collectionOfWeaponEmbed(interaction, id, user, weaponType, skinsResponse.skins, parseInt(pageIndex)));
    },
  };
  