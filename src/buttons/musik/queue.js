const { EmbedBuilder, ApplicationCommandType } = require("discord.js");
const { splitBar } = require("string-progressbar");
const prettyMs = require("pretty-ms");

/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "queue",
  description: "Shows Queue",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    // const page = interaction.options.getInteger("page");
    const response = getQueue(interaction, 1);
    interaction.update(response);
    // await interaction.followUp(response);
  },
};

/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 * @param {number} pgNo
 */
function getQueue({ client, guild }, pgNo) {
    const player = client.lavalink.getPlayer(guild.id);
    if (!player) {
      const embedNoMusic = new EmbedBuilder()
        .setColor(client.config.EMBED_COLORS.ERROR)
        .setAuthor({name: "Error"})
        .setDescription("🚫 There is no music playing in this guild.")
      return { embeds: [embedNoMusic] };
    }
    
    const queue = player.queue;
    console.log(player.textChannelId);

    const currentlyPlaying = queue.current;
    const tracks = queue.tracks.slice(0, 10);
    const queuedSongs = tracks.map((track, index) => {
        const songNumber = index + 1;
        const duration = prettyMs(track.info.duration, { colonNotation: true, secondsDecimalDigits: 0 });

        return `\`${songNumber}.\` [${track.info.title}](${track.info.uri}) \`[${duration}]\``;
      })
      .join('\n');

    const artist = currentlyPlaying.info.author;
    const thumbnailUrl = currentlyPlaying.info.artworkUrl;
    const requestedBy = currentlyPlaying.requester.id;
    const totalLength = queue.tracks.reduce((accumulator, current) => accumulator + current.info.duration, 0);

    const position = player.position;
    const button = '▶️';
    const progressBar = splitBar(currentlyPlaying.info.duration > 6.048e8 ? position : currentlyPlaying.info.duration, position, 15)[0]
    const elapsedTime = currentlyPlaying.info.duration > 6.048e8 ? "🔴 LIVE" : `${prettyMs(position, { colonNotation: true, secondsDecimalDigits: 0 })}/${prettyMs(currentlyPlaying.info.duration, { colonNotation: true })}`;
    // const loop = player.loopCurrentSong ? '🔂' : player.loopCurrentQueue ? '🔁' : '';
    const loop = player.repeatMode;
    
    const vol = player.volume;
    const playerBar =  `${button} ${progressBar} \`[${elapsedTime}]\`🔉 ${vol} ${loop}`;

    const message = new EmbedBuilder();

    let description = `**[${currentlyPlaying.info.title}](${currentlyPlaying.info.uri})**\n`;
    description += `Requested by: <@${requestedBy}>\n\n`;
    description += `${playerBar}\n\n`;

    if (player.queue.tracks.length > 0) {
      description += '**Up next:**\n';
      description += queuedSongs;
    }

    message
      // .setTitle(player.status === STATUS.PLAYING ? `Now Playing ${player.loopCurrentSong ? '(loop on)' : ''}` : 'Queued songs')
      .setTitle(`Now Playing`)
      .setColor(player.playing === true ? 'DarkGreen' : 'NotQuiteBlack')
      .setDescription(description)
      .addFields([{name: 'In queue', value: `${queue.tracks.length > 0 ? queue.tracks.length : '-'}`, inline: true}, {
        name: 'Total length', value: `${totalLength > 0 ? prettyMs(totalLength, { colonNotation: true, secondsDecimalDigits: 0 }) : '-'}`, inline: true,
      }])
      .setFooter({text: `Source: ${artist}`});

    if (thumbnailUrl) {
      message.setThumbnail(thumbnailUrl);
    }
  
    return { embeds: [message] };
}