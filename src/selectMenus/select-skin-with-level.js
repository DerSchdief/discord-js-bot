const { ApplicationCommandType, StringSelectMenuBuilder, ActionRowBuilder, StringSelectMenuOptionBuilder} = require("discord.js");
const { s, getSkin, l } = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseSelectMenu")}
*/
module.exports = {
  id: "select-skin-with-level",
  description: "select-skin-with-level",
  type: ApplicationCommandType.User,
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    let skinUuid = interaction.values[0];
    let skin = await getSkin(skinUuid);
    const levelSelector = new StringSelectMenuBuilder()
        .setCustomId(`get-level-video`)
        .setPlaceholder(s(interaction).info.SELECT_LEVEL_OF_SKIN)

    if(!skin){
        const req = await fetch(`https://valorant-api.com/v1/weapons/skins/${skinUuid}?language=all`);
        skin = JSON.parse(req.body).data;
        skinUuid = skin.levels[0].uuid;
    }

    for (let i = 0; i < skin.levels.length; i++) {
        const level = skin.levels[i];
        if (level.streamedVideo) {
            let skinName = l(level.displayName, interaction);
            if (skinName.length > 100) skinName = skinName.slice(0, 96) + " ...";
            levelSelector.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${skinName}`)
                    .setValue(`levels/${level.uuid}/${skinUuid}`))
        }
    }

    for (let i = 0; i < skin.chromas.length; i++) {
        const chromas = skin.chromas[i];
        if (chromas.streamedVideo) {
            let chromaName = l(chromas.displayName, interaction);
            if (chromaName.length > 100) chromaName = chromaName.slice(0, 96) + " ...";
            levelSelector.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${chromaName}`)
                    .setValue(`chromas/${chromas.uuid}/${skinUuid}`))
        }
    }

    await interaction.reply({ components: [new ActionRowBuilder().addComponents(levelSelector)], ephemeral: true })
  },
};
