const { EmbedBuilder, ApplicationCommandType, } = require("discord.js");

/**
* @type {import("@structures/BaseSelectMenu")}
*/
module.exports = {
  id: "testselectmenu",
  description: "TestSelectMenu",
  type: ApplicationCommandType.User,
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  execurunte(interaction) {
    if (interaction.values.includes('first_option')) {
      interaction.followUp({ embeds: [ new EmbedBuilder().setDescription(`✅ | Successful reply for the first option`).setColor(`#00d26a`) ], ephemeral: true });
    } else if (interaction.values.includes('second_option')) {
      interaction.followUp({ embeds: [ new EmbedBuilder().setDescription(`✅ | Successful reply for the second option`).setColor(`#00d26a`) ], ephemeral: true });
    } else if (interaction.values.includes('third_option')) {
      interaction.followUp({ embeds: [ new EmbedBuilder().setDescription(`✅ | Successful reply for the third option`).setColor(`#00d26a`) ], ephemeral: true });
    }
  },
};
