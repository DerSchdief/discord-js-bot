const {
    ApplicationCommandOptionType,
  } = require("discord.js");

const {getNumberOfAccounts, basicEmbed, s, findTargetAccountIndex, deleteUser, deleteWholeUser, readUserJson} = require("@helpers/Valorant");

const fuzzysort = require("fuzzysort");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "forget",
    description: "Forget and permanently delete your account from the bot.",
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
          name: "account",
          description: "The account you want to forget. Leave blank to forget all accounts.",
          required: false,
          autocomplete: true,
          type: ApplicationCommandOptionType.String,
        },
      ],
    },

    async messageRun(message, args, data) {
        //nix
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        const userJson = readUserJson(interaction.user.id);
        if(!userJson) return await interaction.respond([]);

        const values = [];
        for(const [index, account] of Object.entries(userJson.accounts)) {
            const username = account.username || s(interaction).info.NO_USERNAME;
            if(values.find(a => a.name === username)) continue;

            values.push({
                name: username,
                value: (parseInt(index) + 1).toString()
            });
        }

        const filteredValues = fuzzysort.go(focusedValue, values, {
            key: "name",
            threshold: -1000,
            limit: 5,
            all: true
        });

        await interaction.respond(filteredValues.map(value => value.obj));
    },

    async interactionRun(interaction) {
        const accountCount = getNumberOfAccounts(interaction.user.id);
        if (accountCount === 0) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
            ephemeral: true
        });

        const targetAccount = interaction.options.get("account") && interaction.options.get("account").value;
        if (targetAccount) {
            const targetIndex = findTargetAccountIndex(interaction.user.id, targetAccount);

            if (targetIndex === null) return await interaction.followUp({
                embeds: [basicEmbed(s(interaction).error.ACCOUNT_NOT_FOUND)],
                ephemeral: true
            });

            if (targetIndex > accountCount) return await interaction.followUp({
                embeds: [basicEmbed(s(interaction).error.ACCOUNT_NUMBER_TOO_HIGH.f({ n: accountCount }))],
                ephemeral: true
            });

            const usernameOfDeleted = deleteUser(interaction.user.id, targetIndex);

            await interaction.followUp({
                embeds: [basicEmbed(s(interaction).info.SPECIFIC_ACCOUNT_DELETED.f({ n: targetIndex, u: usernameOfDeleted }, interaction))],
            });
        } else {
            deleteWholeUser(interaction.user.id);
            interaction.client.logger.debug(`${interaction.user.tag} deleted their account`);

            await interaction.followUp({
                embeds: [basicEmbed(s(interaction).info.ACCOUNT_DELETED)],
                ephemeral: true
            });
        }
    }
  }