const {
    ApplicationCommandType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");


/**
* @type {import("@structures/BaseModal")}
*/
module.exports = {
    id: "volumeModal",
    description: "Volume Modal",
    type: ApplicationCommandType.User,
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,
  
    async run(interaction) {
      const volumeValue = interaction.fields.getTextInputValue('volumeInput');
      const response = await volume(interaction, volumeValue);
      await interaction.update(response); 
    },
};
  

/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 * @param {string} volumeValue
 */
async function volume({ client, member, guild, channel }, volumeValue) {
    if (!member.voice.channel) {
      const embedJoinFirst = new EmbedBuilder()
        .setColor(client.config.EMBED_COLORS.ERROR)
        .setAuthor({name: "Error"})
        .setDescription("🚫 You need to join a voice channel first")
      return { embeds: [embedJoinFirst] };
    }
  
    const embedDefaultCaseError = new EmbedBuilder()
      .setColor(client.config.EMBED_COLORS.ERROR)
      .setAuthor({name: "Error"})
      .setDescription("🚫 An error occurred while trying to change Volume")
  
    let player = client.lavalink.getPlayer(guild.id);
    if (player && !guild.members.me.voice.channel) {
      player.disconnect();
      await guild.client.lavalink.destroyPlayer(guild.id);
    }
  
    if (player && member.voice.channel !== guild.members.me.voice.channel) {
      const embedSameVcAsMe = new EmbedBuilder()
        .setColor(client.config.EMBED_COLORS.ERROR)
        .setAuthor({name: "Error"})
        .setDescription("🚫 You must be in the same voice channel as mine")
      return { embeds: [embedSameVcAsMe] };
    }
  
    let embed = new EmbedBuilder().setColor(client.config.EMBED_COLORS.BOT_EMBED);

    // console.log('Value ' + volumeValue);

    if (!volumeValue) {
        embed
          .setAuthor({ name: "Volume Check" })
          .setDescription(`🎶 The player volume is \`${player.volume}\``);
    } else {
      if (volumeValue < 1 || volumeValue > 100) {
        embed
          .setColor(client.config.EMBED_COLORS.ERROR)
          .setAuthor({ name: "Error" })
          .setDescription("🚫 you need to give me a volume between 1 and 100.");
      } else {
          await player.setVolume(volumeValue, false);
          embed
            .setAuthor({ name: "Volume set" })
            .setDescription(`🎶 Music player volume is set to \`${volumeValue}\`.`);
      }
    }    
  
    return { embeds: [embed] };
  }
  