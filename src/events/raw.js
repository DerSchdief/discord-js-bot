/**
 * @param {import('@src/structures').BotClient} client

 */
module.exports = async (client, data) => {
    if(client.config.MUSIC.ENABLED) {
      client.lavalink.sendRawData(data);
    }
  };
  