const { ApplicationCommandType, } = require("discord.js");
const { getSkin, l } = require("@helpers/Valorant");
const config = require("@root/config");

/**
* @type {import("@structures/BaseSelectMenu")}
*/
module.exports = {
  id: "get-level-video",
  description: "get-level-video",
  type: ApplicationCommandType.User,
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    const [type, uuid, skinUuid] = interaction.values[0].split('/');
    const rawSkin = await getSkin(skinUuid);
    const skin = rawSkin[type].filter(x => x.uuid === uuid);
    const name = l(skin[0].displayName, interaction)
    const baseLink = "https://embed.arthurdev.web.tr/s";
    let link;
    config.viewerWithSite ? link = baseLink + `?link=${skin[0].streamedVideo}&title=${encodeURI(client.user.username)}` : link = skin[0].streamedVideo
    await interaction.reply({ content: `\u200b[${name}](${link})`, ephemeral: true })
  },
};
