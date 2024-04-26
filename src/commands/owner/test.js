const {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
  } = require("discord.js");
const {getUser, basicEmbed, s, fetchShop, f ,defer, getSetting} = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "test",
    description: "shows the current ping from the bot to the discord servers",
    category: "OWNER",
    command: {
      enabled: false,
    },
    slashCommand: {
      enabled: true,
      ephemeral: true,
      options: [],
    },
  
    async messageRun(message, args) {
      await message.safeReply(`🏓 Pong : \`${Math.floor(message.client.ws.ping)}ms\``);
    },
  
    async interactionRun(interaction) {

      const test = s(interaction).error.OTHER_SHOP_DISABLED;
      const test2 = s(interaction);

      const test3 = f(s(interaction).error.OTHER_SHOP_DISABLED,{u: `<@271653961067528192>`});
      console.log(test);
      console.log(test3);
      // interaction.followUp(`DisplayName: ${interaction.user.global_name} Username: ${interaction.user.username}`);

      // console.log(interaction);
      // console.log(interaction.user);
      // console.log(interaction.member);

      
      // console.log(interaction.client.config);
      // interaction.client.config = ""; // load the config file
      // console.log("Neue Config (sollte leer sein)");
      // console.log(interaction.client.config);


      // interaction.client.config = require("@root/config");
      // console.log("Neue Config (sollte neue Werte haben)");
      // console.log(interaction.client.config);

      // const Row = new ActionRowBuilder().addComponents(
      //   new ButtonBuilder()
      //     .setCustomId("test")
      //     .setLabel("Test Button")
      //     .setStyle(ButtonStyle.Primary)
      // );
  
      // await interaction.followUp({
      //   embeds: [
      //     new EmbedBuilder()
      //       .setDescription(`✅ | Test Button Handler`)
      //       .setColor(`#00d26a`),
      //   ],
      //   components: [Row],
      //   ephemeral: true,
      // });
    },
  };
  