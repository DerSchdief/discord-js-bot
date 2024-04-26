const { EmbedBuilder, ApplicationCommandType } = require("discord.js");


 /**
 * @type {import('@structures/BaseButton')}
 */ 
  module.exports = {
    id: "testbutton",
    description: "test",
    type: ApplicationCommandType.User,
    category: "OWNER",
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,
  
    async run(interaction) {
      const embed = new EmbedBuilder()
      .setTitle(`Avatar of`)
      .setDescription("hallo 1234"
      );

      interaction.followUp({embeds: [embed]})
    },
  };
  