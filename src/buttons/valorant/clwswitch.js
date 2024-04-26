const {
    ApplicationCommandType,
  } = require("discord.js");

const {
    getUser, s, WeaponTypeUuid, authFailureMessage, collectionOfWeaponEmbed, singleWeaponEmbed
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "clwswitch",
  description: "Collection Weapon Switch",
  type: ApplicationCommandType.User,
  category: "VALORANT",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction, client) {
      const [, weaponTypeIndex, switchTo, id] = interaction.customId.split('/');
      const weaponType = Object.values(WeaponTypeUuid)[parseInt(weaponTypeIndex)];
      const switchToPage = switchTo === "p";

      const valorantUser = getUser(interaction.user.id);

      let user;
      if (id !== interaction.user.id) user = getUser(id);
      else user = valorantUser;

      const skinsResponse = await getSkins(user);
      if (!skinsResponse.success) return await interaction.reply(authFailureMessage(interaction, skinsResponse, s(interaction).error.AUTH_ERROR_COLLECTION, id !== interaction.user.id));

      if (switchToPage) await interaction.update(await collectionOfWeaponEmbed(interaction, id, user, weaponType, skinsResponse.skins));
      else await interaction.update(await singleWeaponEmbed(interaction, id, user, weaponType, skinsResponse.skins));
    },
  };
  