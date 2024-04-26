const { EmbedBuilder } = require("discord.js");
const { splitBar } = require("string-progressbar");
const prettyMs = require("pretty-ms");

/**
 * @param {import("@structures/BotClient")} client
 */
module.exports = (client) => {

  // client.logger.success("Test1234");
  // console.log(lavaclient);
  // console.log("Test1234");

    client.lavalink.nodeManager.on("disconnect", (node, reason) => {
        console.log(node.id, " :: DISCONNECT :: ", reason);
    }).on("connect", (node) => {
        console.log(node.id, " :: CONNECTED :: ");
        // testPlay(client); // TEST THE MUSIC ONCE CONNECTED TO THE BOT
    }).on("reconnecting", (node) => {
        console.log(node.id, " :: RECONNECTING :: ");
    }).on("create", (node) => {
        console.log(node.id, " :: CREATED :: ");
    }).on("destroy", (node) => {
        console.log(node.id, " :: DESTROYED :: ");
    }).on("error", (node, error, payload) => {
        console.log(node.id, " :: ERRORED :: ", error, " :: PAYLOAD :: ", payload);
    }).on("resumed", (node, payload, players) => {{
        console.log(node.id, " :: RESUMED :: ", players.length, " PLAYERS STILL PLAYING :: PAYLOAD ::", payload);
        console.log(players);
    }});

    client.lavalink.on("playerCreate", (player) => {
      console.log(player.guildId, " :: Created a Player :: ");
    });

    // client.lavalink.on("playerCreate", (player) => {
    //     console.log(player.guildId, " :: Created a Player :: ");
    // }).on("playerDestroy", (player, reason) => {
    //     console.log(player.guildId, " :: Player got Destroyed :: ");
    //     const channel = client.channels.cache.get(player.textChannelId);
    //     if(!channel) return console.log("No Channel?", player);
    //     channel.send({
    //         embeds: [
    //             new EmbedBuilder()
    //             .setColor("Red")
    //             .setTitle("❌ Player Destroyed")
    //             .setDescription(`Reason: ${reason || "Unknown"}`)
    //             .setTimestamp()
    //         ]
    //     })
    // }).on("playerDisconnect", (player, voiceChannelId) => {
    //     console.log(player.guildId, " :: Player disconnected the Voice Channel :: ", voiceChannelId);
    // }).on("playerMove", (player, oldVoiceChannelId, newVoiceChannelId) => {
    //     console.log(player.guildId, " :: Player moved from Voice Channel :: ", oldVoiceChannelId, " :: To ::", newVoiceChannelId);
    // }).on("playerSocketClosed", (player, payload) => {
    //     console.log(player.guildId, " :: Player socket got closed from lavalink :: ", payload);
    // })

    /**
     * Queue/Track Events
     */

    client.lavalink.on("trackStart", (player, track) => {
        
        const queue = player.queue;

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

        const channel = client.channels.cache.get(player.textChannelId);
        
        if(!channel) return;

        // const test = channel.lastMessageId;
        // channel.messages.fetch("1222626479947645029")
        // .then(message => console.log(message))
        // .catch(console.error);

        channel.messages.fetch({ limit: 1 }).then(messages => {
            let lastMessage = messages.first();

            lastMessage.edit({ embeds: [message]});
          })
          .catch(console.error);
        
        // channel.messages.fetch(test).then(msg => {
        //     msg.edit({ embeds: [message] });
        // });

    });
    // client.lavalink.on("trackStart", (player, track) => {
    //     console.log(player.guildId, " :: Started Playing :: ", track.info.title, "QUEUE:", player.queue.tracks.map(v => v.info.title));
    //     const channel = client.channels.cache.get(player.textChannelId);
    //     if(!channel) return;
    //     const embed = new EmbedBuilder()
    //     .setColor("Blurple")
    //     .setTitle(`🎶 ${track.info.title}`.substring(0, 256))
    //     .setThumbnail(track.info.artworkUrl || track.pluginInfo?.artworkUrl || null)
    //     .setDescription(
    //         [
    //             `> - **Author:** ${track.info.author}`,
    //             `> - **Duration:** ${formatMS_HHMMSS(track.info.duration)} | Ends <t:${Math.floor((Date.now() + track.info.duration) / 1000)}:R>`,
    //             `> - **Source:** ${track.info.sourceName}`,
    //             `> - **Requester:** <@${(track.requester as CustomRequester).id}>`,
    //             track.pluginInfo?.clientData?.fromAutoplay ? `> *From Autoplay* ✅` : undefined
    //         ].filter(v => typeof v === "string" && v.length).join("\n").substring(0, 4096)
    //     )
    //     .setFooter({
    //         text: `Requested by ${(track.requester as CustomRequester)?.username}`,
    //         iconURL: (track?.requester as CustomRequester)?.avatar || undefined
    //     })
    //     .setTimestamp();
    //     // local tracks are invalid uris
    //     if(/^https?:\/\//.test(track.info.uri)) embed.setURL(track.info.uri)
    //     channel.send({
    //         embeds: [ 
    //             embed  
    //         ]
    //     })
    // }).on("trackEnd", (player, track, payload) => {
    //     console.log(player.guildId, " :: Finished Playing :: ", track.info.title)
    // }).on("trackError", (player, track, payload) => {
    //     console.log(player.guildId, " :: Errored while Playing :: ", track.info.title, " :: ERROR DATA :: ", payload)
    // }).on("trackStuck", (player, track, payload) => {
    //     console.log(player.guildId, " :: Got Stuck while Playing :: ", track.info.title, " :: STUCKED DATA :: ", payload)
        
    // }).on("queueEnd", (player, track, payload) => {
    //     console.log(player.guildId, " :: No more tracks in the queue, after playing :: ", track?.info?.title || track)
    //     const channel = client.channels.cache.get(player.textChannelId!) as TextChannel;
    //     if(!channel) return;
    //     channel.send({
    //         embeds: [
    //             new EmbedBuilder()
    //             .setColor("Red")
    //             .setTitle("❌ Queue Ended")
    //             .setTimestamp()
    //         ]
    //     })
    // }).on("playerUpdate", (player) => {
    //     // use this event to udpate the player in the your cache if you want to save the player's data(s) externally!
    //     /**
    //      * 
    //     */
    // });

};
