const {
    ApplicationCommandOptionType,
  } = require("discord.js");

const {getUser, basicEmbed, s, renderCollection, getSetting, WeaponType} = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "collection",
    description: "Show off your skin collection!",
    category: "VALORANT",
    // botPermissions: ["EmbedLinks"],
    // command: {
    //   enabled: true,
    //   usage: "[command]",
    // },
    slashCommand: {
      enabled: true,
      options: [
        {
          name: "weapon",
          description: "Optional: see all your skins for a specific weapon",
          required: false,
          type: ApplicationCommandOptionType.String,
          choices: Object.values(WeaponType).map(weaponName => ({
            name: weaponName,
            value: weaponName,
        })),
        },
        {
          name: "user",
          description: "Optional: see someone else's collection!",
          required: false,
          type: ApplicationCommandOptionType.User,
        },
      ],
    },

    async messageRun(message, args, data) {
        //nix
    },
    
    async interactionRun(interaction) {
      const valorantUser = getUser(interaction.user.id);
      let targetUser = interaction.user;

      const otherUser = interaction.options.getUser("user");
      if (otherUser && otherUser.id !== interaction.user.id) {
          const otherValorantUser = getUser(otherUser.id);
          if (!otherValorantUser) return await interaction.reply({
              embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED_OTHER)]
          });

          if (!getSetting(otherUser.id, "othersCanViewColl")) return await interaction.reply({
              embeds: [basicEmbed(s(interaction).error.OTHER_COLLECTION_DISABLED.f({ u: `<@${otherUser.id}>` }))]
          });

          targetUser = otherUser;
      }
      else if (!valorantUser) return await interaction.reply({
          embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
          ephemeral: true
      });

      const weaponName = interaction.options.getString("weapon");
      const message = await renderCollection(interaction, targetUser.id, weaponName);
      await interaction.followUp(message);

      interaction.client.logger.debug(`Sent ${targetUser.tag}'s collection!`);
    }
  }