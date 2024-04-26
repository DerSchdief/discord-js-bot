const {
    ApplicationCommandType,
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
  } = require("discord.js");

const {
  basicEmbed
} = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "gotopage",
  description: "gotopage",
  type: ApplicationCommandType.User,
  category: "VALORANT",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
  
    async run(interaction) {
      let [, pageId, userId, max] = interaction.customId.split('/');
      let weaponTypeIndex
      if(pageId === 'clwpage') [, pageId, weaponTypeIndex, userId, max] = interaction.customId.split('/');

      if (userId !== interaction.user.id){
          if (pageId === 'changestatspage'){
              return await interaction.reply({
                  embeds: [basicEmbed(s(interaction).error.NOT_UR_MESSAGE_STATS)],
                  ephemeral: true
              });
          }else if (pageId === 'changealertspage'){
              return await interaction.reply({
                  embeds: [basicEmbed(s(interaction).error.NOT_UR_ALERT)],
                  ephemeral: true
              });
          }
      }

      const modal = new ModalBuilder()
          .setCustomId(`gotopage/${pageId}${weaponTypeIndex ? `/${weaponTypeIndex}`: ''}/${userId}/${max}`)
          .setTitle(s(interaction).modal.PAGE_TITLE);

      const pageInput = new TextInputBuilder()
          .setMinLength(1)
          .setMaxLength(calcLength(max))
          .setPlaceholder(s(interaction).modal.PAGE_INPUT_PLACEHOLDER)
          .setRequired(true)
          .setCustomId('pageIndex')
          .setLabel(s(interaction).modal.PAGE_INPUT_LABEL.f({max: max}))
          .setStyle(TextInputStyle.Short);

      const q1 = new ActionRowBuilder().addComponents(pageInput);
      modal.addComponents(q1);
      await interaction.showModal(modal);
    },
  };
  