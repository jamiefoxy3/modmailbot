const fs = require('fs').promises;
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
require('dotenv').config();
const reportCommand = require('./reportCommand');

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.DIRECT_MESSAGE_REACTIONS
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
    allowedMentions: { parse: ["roles", "users", "everyone"], repliedUser: true }
});

const activeTickets = new Map();
const guildId = "1286865915668856924";
const categoryID = "1286866042089508915";
const staffRoleID = "1286866683230814241";
const staffChannelID = "1286866050184642581";
const closedCategoryID = "1286866776306749511";
const additionalRoleID = "1286867909125341205";

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('DM to Contact Staff | OnlyTrans 🏳️‍⚧️❤️', { type: 'PLAYING' });
    await registerSlashCommands();
    const { registerReportCommand } = reportCommand(client);
    await registerReportCommand();
});

async function registerSlashCommands() {
    try {
        const commands = [
            {
                name: 'reply',
                description: 'Reply to the user ticket!',
                type: 'CHAT_INPUT',
                options: [
                    { name: 'message', description: 'Message to send to the user', type: 'STRING', required: true },
                    { name: 'image', description: 'Attach image.', type: 'ATTACHMENT', required: false }
                ]
            },
            {
                name: 'close',
                description: 'Close the current ticket!',
                type: 'CHAT_INPUT',
                options: [{ name: 'reason', description: 'Reason for closing the ticket!', type: 'STRING', required: true }]
            },
            {
                name: 'id',
                description: 'Get the ID of a user, channel, or role',
                type: 'CHAT_INPUT',
                options: [
                    { name: 'user_or_role', description: 'Mention a user or role', type: 'MENTIONABLE', required: false },
                    { name: 'channel', description: 'Mention a channel', type: 'CHANNEL', required: false }
                ]
            }
        ];
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.error('Guild not found.');
            return;
        }
        const commandList = await guild.commands.set(commands);
        console.log(`Registered ${commandList.size} slash commands.`);
    } catch (error) {
        console.error('Failed to register slash commands:', error);
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    await interaction.deferReply({ ephemeral: true });

    try {
        if (commandName === 'close') {
            await handleCloseTicket(interaction, interaction.options.getString('reason'), interaction.channel);
        } else if (commandName === 'reply') {
            await handleReply(interaction, interaction.options.getString('message'), interaction.channel);
        } else if (commandName === 'id') {
            await handleId(interaction);
        }
    } catch (error) {
        console.error(`Error handling ${commandName} command:`, error);
        await interaction.editReply({ content: 'An error occurred while processing your request.', ephemeral: true });
    }
});

async function handleReply(interaction, messageContent, channel) {
    try {
        const ticketInfo = Array.from(activeTickets.values()).find(ticket => ticket.channel === channel.id);
        if (!ticketInfo) {
            await interaction.editReply({ content: 'This is not an active Mod Mail ticket channel.', ephemeral: true });
            return;
        }

        const user = await client.users.fetch(ticketInfo.user);
        const embed = new MessageEmbed()
            .setColor('#ff0000')
            .setTitle('Message Received')
            .setDescription(messageContent)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setFooter({ text: `${interaction.guild.name} | Guild ID: ${interaction.guild.id}`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        if (interaction.options.getAttachment('image')) {
            const attachment = interaction.options.getAttachment('image');
            embed.setImage(attachment.url);
        }

        await user.send({ embeds: [embed] }).catch(console.error);
        await channel.send({ embeds: [embed] }).catch(console.error);
        await interaction.editReply({ content: 'Message sent to the user.', ephemeral: true });
    } catch (error) {
        console.error('Error handling reply command:', error);
        await interaction.editReply({ content: 'An error occurred while processing your request.', ephemeral: true });
    }
}

async function handleCloseTicket(interaction, reason, channel) {
    try {
        const ticketInfo = Array.from(activeTickets.values()).find(ticket => ticket.channel === channel.id);
        if (!ticketInfo) {
            await interaction.editReply({ content: 'This is not an active Mod Mail ticket channel.', ephemeral: true });
            return;
        }

        const user = await client.users.fetch(ticketInfo.user);
        const randomNumber = Math.floor(1000 + Math.random() * 9000);
        const closedCategory = interaction.guild.channels.cache.get(closedCategoryID);

        await channel.setParent(closedCategory.id, { lockPermissions: false });
        await channel.permissionOverwrites.set([
            { id: interaction.guild.roles.everyone.id, deny: ['VIEW_CHANNEL'] },
            { id: staffRoleID, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_CHANNELS'] }
        ]);
        await channel.setName(`closed-${randomNumber}`);

        activeTickets.delete(ticketInfo.user);

        const closingMessageEmbed = new MessageEmbed()
            .setColor('#e74c3c')
            .setTitle('Ticket Closed')
            .setDescription('Your ticket has been closed. If you require further assistance, please open a new ticket.')
            .setTimestamp();

        const userDMEmbed = new MessageEmbed()
            .setColor('#e74c3c')
            .setTitle('Ticket Closed')
            .setDescription(`${reason}`)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setFooter({ text: `OnlyTrans | Guild ID: ${interaction.guild.id}`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        const modmailLogEmbed = new MessageEmbed()
            .setColor('#e74c3c')
            .setTitle('Ticket Closed')
            .setDescription(`${reason}\n\nTicket: closed-${randomNumber}`)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setFooter({ text: `OnlyTrans | Guild ID: ${interaction.guild.id}`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        await user.send({ embeds: [closingMessageEmbed, userDMEmbed] }).catch(console.error);

        const staffChannel = client.channels.cache.get(staffChannelID);
        if (staffChannel) {
            await staffChannel.send({ embeds: [modmailLogEmbed] }).catch(console.error);
        } else {
            console.log('Staff channel not found.');
        }

        // Reply to the user that the ticket was successfully closed
        await interaction.editReply({ content: 'Ticket was successfully closed proceed to delete the ticket.', ephemeral: true });

        // Send a new embed with delete button
        const deleteEmbed = new MessageEmbed()
            .setColor('#e74c3c')
            .setTitle('Ticket Closed')
            .setDescription(`Ticket closed by ${interaction.user.tag}. Click the button below to delete this ticket.`)
            .setTimestamp();

        const deleteButton = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId('delete_ticket')
                .setLabel('Delete Ticket')
                .setStyle('DANGER')
        );

        await channel.send({ embeds: [deleteEmbed], components: [deleteButton] });

    } catch (error) {
        console.error('Error handling close ticket command:', error);
        await interaction.editReply({ content: 'An error occurred while processing your request.', ephemeral: true });
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'delete_ticket') {
        await handleDeleteTicket(interaction);
    }
});

async function handleDeleteTicket(interaction) {
    try {
        if (!interaction.member.roles.cache.has(staffRoleID)) {
            await interaction.reply({ content: 'You do not have permission to delete this ticket.', ephemeral: true });
            return;
        }

        await interaction.deferUpdate();

        const channel = interaction.channel;
        const ticketInfo = Array.from(activeTickets.values()).find(ticket => ticket.channel === channel.id);

        const countdownEmbed = new MessageEmbed()
            .setColor('#e74c3c')
            .setTitle('Ticket Deletion Countdown')
            .setDescription('This ticket will be deleted in:');

        const countdownMessage = await channel.send({ embeds: [countdownEmbed] });

        for (let seconds = 5; seconds > 0; seconds--) {
            await countdownMessage.edit({ embeds: [countdownEmbed.setDescription(`This ticket will be deleted in: ${seconds} seconds`)] });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await channel.delete();
        if (ticketInfo) {
            activeTickets.delete(ticketInfo.user);
        }
    } catch (error) {
        console.error('Error handling delete ticket:', error);
        await interaction.followUp({ content: 'An error occurred while deleting the ticket.', ephemeral: true });
    }
}

async function handleId(interaction) {
    const userOrRole = interaction.options.getMentionable('user_or_role');
    const channel = interaction.options.getChannel('channel');
    let idEmbed = new MessageEmbed().setColor('#f5f5f5');

    if (userOrRole) {
        if (userOrRole.user) {
            const userMention = userOrRole.user.bot ? `<@${userOrRole.user.id}>` : `<@!${userOrRole.user.id}>`;
            idEmbed.setDescription(`${userMention} | ${userOrRole.user.id}`);
        } else {
            idEmbed.setDescription(`<@&${userOrRole.id}> | ${userOrRole.id}`);
        }
    } else if (channel) {
        idEmbed.setDescription(`<#${channel.id}> | ${channel.id}`);
    } else {
        idEmbed.setDescription('Please mention a user, role, or channel.');
    }

    await interaction.editReply({ embeds: [idEmbed] });
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.type === 'DM') {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.error('Guild not found.');
            return;
        }

        const ticketInfo = Array.from(activeTickets.values()).find(ticket => ticket.user === message.author.id);

        if (ticketInfo) {
            const ticketChannel = guild.channels.cache.get(ticketInfo.channel);
            if (ticketChannel) {
                if (ticketInfo.closed) {
                    await promptNewTicket(message, guild);
                } else {
                    const embed = new MessageEmbed()
                        .setColor('#00ff00')
                        .setTitle('Message Sent')
                        .setDescription(message.content)
                        .setFooter({ text: `User: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                        .setTimestamp(message.createdAt);

                    if (message.attachments.size > 0) {
                        const attachment = message.attachments.first();
                        embed.setImage(attachment.url);
                    } else if (message.embeds.length > 0 && message.embeds[0].type === 'gifv') {
                        embed.setImage(message.embeds[0].thumbnail.url);
                    } else if (message.content.match(/\.(gif|jpe?g|png|mp4|webm)$/i)) {
                        embed.setImage(message.content);
                    }

                    await ticketChannel.send({ embeds: [embed] }).catch(console.error);
                    await message.author.send({ embeds: [embed] }).catch(console.error);
                }
            } else {
                console.log(`Ticket channel not found for active ticket: ${ticketInfo.channel}`);
                activeTickets.delete(message.author.id);
                await promptNewTicket(message, guild);
            }
        } else {
            await promptNewTicket(message, guild);
        }
    }
});

async function promptNewTicket(message, guild) {
    const confirmationEmbed = new MessageEmbed()
        .setColor('#3498db')
        .setTitle('Confirmation')
        .setDescription(`If you are going to open a report or question Please indicate in your initial message that you are sending If you wish to make a complaint against a staff member. Please do not use Modmail to submit complaints about staff members. Instead, DM Owners+.`);

    const confirmationMessage = await message.author.send({ embeds: [confirmationEmbed] }).catch(console.error);
    if (!confirmationMessage) return;

    await confirmationMessage.react('✅');
    await confirmationMessage.react('❎');

    const filter = (reaction, user) => ['✅', '❎'].includes(reaction.emoji.name) && !user.bot && user.id === message.author.id;
    const collected = await confirmationMessage.awaitReactions({ filter, max: 1, time: 60000 }).catch(console.error);

    if (collected && collected.size > 0) {
        const reaction = collected.first();
        if (reaction.emoji.name === '✅') {
            await confirmationMessage.delete().catch(console.error);
            try {
                const username = message.author.username.replace(/[^a-zA-Z0-9]/g, '');
                const ticketChannel = await guild.channels.create(`ticket-${username}`, {
                    type: 'GUILD_TEXT',
                    parent: categoryID,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: ['VIEW_CHANNEL'] },
                        { id: staffRoleID, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_CHANNELS'] },
                        { id: additionalRoleID, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'] }
                    ]
                });

                await ticketChannel.setTopic(`User ID: ${message.author.id}`);

                const ticketEmbed = new MessageEmbed()
                    .setColor('#3498db')
                    .setTitle(`${message.author.tag} has opened a ticket!`)
                    .setDescription(`User ID: ${message.author.id}\nTicket Channel: ${ticketChannel}`);

                await ticketChannel.send({ content: `<@&${staffRoleID}> <@&${additionalRoleID}>`, embeds: [ticketEmbed] }).catch(console.error);

                const greetingEmbed = new MessageEmbed()
                    .setColor('#3498db')
                    .setTitle('Greeting Message')
                    .setDescription(`${message.author.username}, You've successfully opened a ticket with OnlyTrans staff team. Staff will be with you shortly.`);

                await message.author.send({ embeds: [greetingEmbed] }).catch(console.error);

                activeTickets.set(message.author.id, { channel: ticketChannel.id, user: message.author.id, closed: false });

                const initialMessageEmbed = new MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('Message Sent')
                    .setDescription(message.content)
                    .setFooter({ text: `User: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                    .setTimestamp(message.createdAt);

                if (message.attachments.size > 0) {
                    const attachment = message.attachments.first();
                    initialMessageEmbed.setImage(attachment.url);
                } else if (message.embeds.length > 0 && message.embeds[0].type === 'gifv') {
                    initialMessageEmbed.setImage(message.embeds[0].thumbnail.url);
                } else if (message.content.match(/\.(gif|jpe?g|png|mp4|webm)$/i)) {
                    initialMessageEmbed.setImage(message.content);
                }

                await ticketChannel.send({ embeds: [initialMessageEmbed] }).catch(console.error);
                await message.author.send({ embeds: [initialMessageEmbed] }).catch(console.error);

                const staffChannel = client.channels.cache.get(staffChannelID);
                if (staffChannel) {
                    const staffEmbed = new MessageEmbed()
                        .setColor('#00ff00')
                        .setTitle(`${message.author.tag} has opened a ticket ❤️`)
                        .setDescription(`User ID: ${message.author.id}\nTicket Channel: ${ticketChannel}`);
                    await staffChannel.send({ embeds: [staffEmbed] }).catch(console.error);
                } else {
                    console.log('Staff channel not found.');
                }
            } catch (error) {
                console.error('Error creating ticket channel:', error);
                const errorEmbed = new MessageEmbed()
                    .setColor('#ff0000')
                    .setDescription('There was an error creating your Mod Mail Ticket. Please contact support.');
                await message.author.send({ embeds: [errorEmbed] }).catch(console.error);
            }
        } else if (reaction.emoji.name === '❎') {
            const cancelEmbed = new MessageEmbed()
                .setColor('#e74c3c')
                .setTitle('Request Cancelled')
                .setDescription('You have cancelled the request.');
            await confirmationMessage.edit({ embeds: [cancelEmbed] }).catch(console.error);
        }
        } else {
        const timeoutEmbed = new MessageEmbed()
            .setColor('#e74c3c')
            .setTitle('Request Timeout')
            .setDescription('You did not react in time. Please try again if you need assistance.');
        await confirmationMessage.edit({ embeds: [timeoutEmbed] }).catch(console.error);
        }
        }

        client.login(process.env.TOKEN).catch(console.error);

        // Add this at the end of your file to handle unhandled promise rejections
        process.on('unhandledRejection', (error) => {
        console.error('Unhandled promise rejection:', error);
        });
