const {
    ApplicationCommandOptionType,
  } = require("discord.js");

const {getUser, basicEmbed, s, fetchShop, f ,defer, getSetting} = require("@helpers/Valorant");


/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "shop",
    description: "Zeigt deinen aktuellen Shop",
    category: "VALORANT",
    // botPermissions: ["EmbedLinks"],
    // command: {
    //   enabled: true,
    //   usage: "[command]",
    // },
    slashCommand: {
      enabled: true,
      options: [
        {
          name: "user",
          description: "Optional: see the daily shop of someone else!",
          required: false,
          type: ApplicationCommandOptionType.User,
        },
      ],
    },

    async messageRun(message, args, data) {
        //nix
    },

    async interactionRun(interaction) {
        let targetUser = interaction.user;
        const valorantUser = getUser(interaction.user.id);

        

        const otherUser = interaction.options.getUser("user");

        const test = s(interaction).error.OTHER_SHOP_DISABLED;
        // const test = f(s(interaction).error.OTHER_SHOP_DISABLED,{u: `<@${otherUser.id}>`});
        // interaction.client.logger.debug(test);

        if(otherUser && otherUser.id !== interaction.user.id) {
            const otherValorantUser = getUser(otherUser.id);
            if(!otherValorantUser) return await interaction.followUp({
                embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED_OTHER)]
            });
            
            if(!getSetting(otherUser.id, "othersCanViewShop")) return await interaction.followUp({
                embeds: [basicEmbed(f(s(interaction).error.OTHER_SHOP_DISABLED,{u: `<@${otherUser.id}>`}))]
            });

            // if(!getSetting(otherUser.id, "othersCanViewShop")) return await interaction.followUp({
            //   embeds: [basicEmbed()]
            // });

            targetUser = otherUser;
        }
        else if(!valorantUser) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
            ephemeral: true
        });

        const message = await fetchShop(interaction, valorantUser, targetUser.id);
        await interaction.followUp(message);

        interaction.client.logger.debug(`Sent ${targetUser.tag}'s shop!`); // also logged if maintenance/login failed
    }
  }