const {
    ApplicationCommandType,
  } = require("discord.js");

const {
    basicEmbed, s, getBundle, VPEmoji, renderBundle
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "viewbundle",
  description: "View Bundle Button",
  type: ApplicationCommandType.User,
  category: "VALORANT",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction) {
      const [, id, uuid] = interaction.customId.split('/');

      if (id !== interaction.user.id) return await interaction.followUp({
          embeds: [basicEmbed(s(interaction).error.NOT_UR_MESSAGE_BUNDLE)],
          ephemeral: true
      });

      const bundle = await getBundle(uuid);
      const emoji = await VPEmoji(interaction);
      await interaction.update({
          components: [],
          ...await renderBundle(bundle, interaction, emoji),
      });
    },
  };
  