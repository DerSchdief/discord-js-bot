const {
    ApplicationCommandOptionType,
  } = require("discord.js");

const {
        readUserJson, basicEmbed, s, getNumberOfAccounts, findTargetAccountIndex,
        switchAccount
    } = require("@helpers/Valorant");
const fuzzysort = require("fuzzysort");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "account",
    description: "Switch the Valorant account you are currently using",
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
          description: "The account you want to switch to",
          required: true,
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
        const userJson = readUserJson(interaction.user.id);

        const accountCount = getNumberOfAccounts(interaction.user.id);
        if (accountCount === 0) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
            ephemeral: true
        });

        const targetAccount = interaction.options.get("account").value;
        const targetIndex = findTargetAccountIndex(interaction.user.id, targetAccount);

        const valorantUser = switchAccount(interaction.user.id, targetIndex);
        if (targetIndex === null) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.ACCOUNT_NOT_FOUND)],
            ephemeral: true
        });

        if (targetIndex === userJson.currentAccount) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).info.ACCOUNT_ALREADY_SELECTED.f({ u: valorantUser.username }, interaction, false))],
            ephemeral: true
        });

        if (targetIndex > accountCount) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.ACCOUNT_NUMBER_TOO_HIGH.f({ n: accountCount }))],
            ephemeral: true
        });



        await interaction.followUp({
            embeds: [basicEmbed(s(interaction).info.ACCOUNT_SWITCHED.f({ n: targetIndex, u: valorantUser.username }, interaction))],
        });
        }
    }