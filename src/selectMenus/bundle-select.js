const { ApplicationCommandType, } = require("discord.js");
const { basicEmbed, getBundle, VPEmoji, renderBundle, s } = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseSelectMenu")}
*/
module.exports = {
  id: "bundle-select",
  description: "Select Bundle Menu",
  type: ApplicationCommandType.User,
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    if(interaction.message.interaction.user.id !== interaction.user.id) {
      return await interaction.update({
          embeds: [basicEmbed(s(interaction).error.NOT_UR_MESSAGE_BUNDLE)],
          ephemeral: true
      });
    }

    const chosenBundle = interaction.values[0].substring(7);
    const bundle = await getBundle(chosenBundle);

    const channel = interaction.channel || await fetchChannel(interaction.channelId);
    const emoji = await VPEmoji(interaction, channel);
    const message = await renderBundle(bundle, interaction, emoji);

    // await interaction.update({
    //     embeds: message.embeds,
    //     components: []
    // });

    await interaction.message.edit({
      embeds: message.embeds,
      components: []
    });

    // await interaction.update(message);
  },
};
