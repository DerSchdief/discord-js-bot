const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ApplicationCommandOptionType,
  } = require("discord.js");

const {
        getUser, basicEmbed, s, fetchChannel, defer, addAlert,
        canSendMessages, authUser, authFailureMessage, secondaryEmbed,
        searchSkin, alertExists, removeAlertActionRow, skinChosenEmbed, 
        discToValLang, DEFAULT_VALORANT_LANG, valNamesToDiscordNames, l, 
        skinNameAndEmoji
    } = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "alert",
    description: "Set an alert for when a particular skin is in your shop.",
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
          name: "skin",
          description: "The name of the skin you want to set an alert for",
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
        const searchResults = await searchSkin(focusedValue, interaction.locale, 5);

        await interaction.respond(searchResults.map(result => ({
            name: result.obj.names[discToValLang[interaction.locale] || DEFAULT_VALORANT_LANG],
            value: result.obj.names[DEFAULT_VALORANT_LANG],
            // nameLocalizations: valNamesToDiscordNames(result.obj.names) // does this even work?
        })));
    },

    async interactionRun(interaction) {
        const valorantUser = getUser(interaction.user.id);

        if (!valorantUser) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.NOT_REGISTERED)],
            ephemeral: true
        });

        const channel = interaction.channel || await fetchChannel(interaction.channelId);
        if (!canSendMessages(channel)) return await interaction.followUp({
            embeds: [basicEmbed(s(interaction).error.ALERT_NO_PERMS)]
        });

        const auth = await authUser(interaction.user.id);
        if (!auth.success) return await interaction.followUp(authFailureMessage(interaction, auth, s(interaction).error.AUTH_ERROR_ALERTS));

        const searchQuery = interaction.options.get("skin").value
        const searchResults = await searchSkin(searchQuery, interaction.locale, 25);

        // filter out results for which the user already has an alert set up
        const filteredResults = [];
        for (const result of searchResults) {
            const otherAlert = alertExists(interaction.user.id, result.obj.uuid);
            if (!otherAlert) filteredResults.push(result);
        }

        if (filteredResults.length === 0) {
            if (searchResults.length === 0) return await interaction.followUp({
                embeds: [basicEmbed(s(interaction).error.SKIN_NOT_FOUND)]
            });

            const skin = searchResults[0].obj;
            const otherAlert = alertExists(interaction.user.id, skin.uuid);
            return await interaction.followUp({
                embeds: [basicEmbed(s(interaction).error.DUPLICATE_ALERT.f({ s: await skinNameAndEmoji(skin, interaction.channel, interaction), c: otherAlert.channel_id }))],
                components: [removeAlertActionRow(interaction.user.id, skin.uuid, s(interaction).info.REMOVE_ALERT_BUTTON)],
                ephemeral: true
            });
        } else if (filteredResults.length === 1 ||
            l(filteredResults[0].obj.names, interaction.locale).toLowerCase() === searchQuery.toLowerCase() ||
            l(filteredResults[0].obj.names).toLowerCase() === searchQuery.toLowerCase()) {
            const skin = filteredResults[0].obj;

            addAlert(interaction.user.id, {
                uuid: skin.uuid,
                channel_id: interaction.channelId
            });

            return await interaction.followUp({
                embeds: [await skinChosenEmbed(interaction, skin)],
                components: [removeAlertActionRow(interaction.user.id, skin.uuid, s(interaction).info.REMOVE_ALERT_BUTTON)],
            });
        } else {
            const row = new ActionRowBuilder();
            const options = filteredResults.splice(0, 25).map(result => {
                return {
                    label: l(result.obj.names, interaction),
                    value: `skin-${result.obj.uuid}`
                }
            });
            row.addComponents(new StringSelectMenuBuilder().setCustomId("skin-select").setPlaceholder(s(interaction).info.ALERT_CHOICE_PLACEHOLDER).addOptions(options));

            await interaction.followUp({
                embeds: [secondaryEmbed(s(interaction).info.ALERT_CHOICE)],
                components: [row]
            });
        }
    }
  }