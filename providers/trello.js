// trello.js
// https://developers.trello.com/apis/webhooks
// ========
const BaseProvider = require('../util/BaseProvider');
const rpn = require('request-promise-native');
const urlMod = require('url');

//Regular Expressions
const headerRegex = new RegExp('#{1,3} ?(.*)\\n');
const imageRegex = new RegExp('!\\[.*\]\\((.*)\\)');
const bulletRegex = new RegExp('\\*', 'g')

class Trello extends BaseProvider {

    constructor(){
        super();
        this.baseLink = 'https://trello.com/';
        this.avatarurl = 'https://trello-avatars.s3.amazonaws.com/';
        this.defTrelloColors = {
            blue: 0x0079bf,
            yellow: 0xd9b51c,
            orange: 0xd29034,
            green: 0x519839,
            red: 0xb04632,
            purple: 0x89609e,
            pink: 0xcd5a91,
            lime: 0x4bbf6b,
            sky: 0x00aecc,
            grey: 0x838c91,
            trello: 0x026aa7,
            nocolor: 0xb6bbbf
        };
    }

    static getName() {
        return 'Trello';
    }

    async getType(){
        return this.req.body.action.type;
    }

    // Utility Functions

    static _addMemberThumbnail(avatarHash, embed){
        if(avatarHash != null && avatarHash !== 'null'){
            embed.thumbnail = {
                url: this.avatarurl + avatarHash + '/170.png'
            };
        }
    }

    static _formatLargeString(str, limit = 256){
        return (str.length > limit ? str.substring(0, limit-1) + '\u2026' : str);
    }

    static _formatMarkdownHeader(str){
        let match;
        while(headerRegex.test(str)){
            match = headerRegex.exec(str);
            str = str.replace(headerRegex, '**' + match[1] + '**\n');
        }
        return str;
    }

    static _formatMarkdownImage(str, embed){
        if(imageRegex.test(str)){
            let match = imageRegex.exec(str);
            embed.image = {url: match[1]};
            str = str.replace(imageRegex, '');
        }
        return str;
    }

    static _formatMarkdownBullets(str){
        if(bulletRegex.test(str)){
            str = str.replace(bulletRegex, '\u2022');
        }
        return str;
    }

    static _formatMarkdown(str, embed){
        str = Trello._formatMarkdownBullets(str);
        str = Trello._formatMarkdownHeader(str);
        str = Trello._formatMarkdownImage(str, embed);

        return str;
    }

    _resolveFullCardURL(card){
        return this.baseLink + 'c/' + card.shortLink + '/' + card.idShort + '-' + card.name.replace(/\s/g, '-').toLowerCase();
    }

    _resolveFullBoardURL(board){
        return this.baseLink + 'b/' + board.shortLink + '/' + board.name.replace(/\s/g, '-').toLowerCase();
    }

    _resolveFullCommentURL(card, commentID){
        return this._resolveFullCardURL(card) + '#comment-' + commentID;
    }

    _resolveCardURL(id){
        return this.baseLink + 'c/' + id;
    }

    _resolveBoardURL(id){
        return this.baseLink + 'b/' + id;
    }

    _resolveCommentURL(cardID, commentID){
        return this._resolveCardURL + '#comment-' + commentID;
    }

    _resolveGenericURL(id){
        return this.baseLink + id;
    }

    _formatAttachment(attachment, embed){
        if(attachment.previewUrl != null){
            embed.image = {url: attachment.previewUrl};
        }
        if(attachment.url != null){
            if(attachment.name !== attachment.url){
                embed.fields = [{
                    name: attachment.name,
                    value: attachment.url
                }];
            } else {
                embed.description = attachment.url; 
            }
        } else {
            embed.description = attachment.name;
        }
    }

    _formatLabel(text, value, embed){
        if(value && this.defTrelloColors[value] != null){
            this.payload.setEmbedColor(this.defTrelloColors[value]);
        } else {
            this.payload.setEmbedColor(this.defTrelloColors.nocolor);
        }
        if(text){
            embed.description = '`' + text + '`';
        }
    }

    _resolveUser(){
        const memberCreator = this.req.body.action.memberCreator;
        return {
            name: memberCreator.fullName,
            icon_url: this.avatarurl + memberCreator.avatarHash + '/170.png',
            url: this.baseLink + memberCreator.username
        };
    }

    _preparePayload(){
        this.action = this.req.body.action;
        this.model = this.req.body.model;

        //Testing code.
        //console.info(this.body);
        //console.info(this.action.data);

        //Use the background color of the board if applicable. Otherwise, use the default trello color.
        if(this.model.prefs != null && this.model.prefs.background != null && this.defTrelloColors[this.model.prefs.background] != null){
            this.payload.setEmbedColor(this.defTrelloColors[this.model.prefs.background]);
        } else {
            this.payload.setEmbedColor(this.defTrelloColors.trello);
        }

        return {
            author: this._resolveUser()
        };
    }

    // Webhook Type Responses

    async addAttachmentToCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Added Attachment to "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this._formatAttachment(this.action.data.attachment, embed);
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async addBoardsPinnedToMember(){

    }

    async addChecklistToCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Added Checklist to "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        embed.description = '`' + this.action.data.checklist.name + '` has been created.';
        this.payload.addEmbed(embed);
    }

    async addLabelToCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Added Label to "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this._formatLabel(this.action.data.text, this.action.data.value, embed);
        this.payload.addEmbed(embed);
    }

    async addMemberToCard(){
        let embed = this._preparePayload();
        if(this.action.memberCreator.id === thos.action.member.id){
            embed.title = '[' + this.action.data.board.name + '] Joined "' + this.action.data.card.name + '"';
        } else {
             embed.title = '[' + this.action.data.board.name + '] Added User to "' + this.action.data.card.name + '"';
            Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
            embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        }
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this.payload.addEmbed(embed);
    }

    async addMemberToBoard(){
        let embed = this._preparePayload();
        if(this.action.memberCreator.id === this.action.member.id){
            embed.title = 'Joined Board "' + this.action.data.board.name + '"';
        } else {
             embed.title = 'Added User to Board "' + this.action.data.board.name + '"';
            Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
            embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        }
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async addMemberToOrganization(){
        let embed = this._preparePayload();
        if(this.action.memberCreator.id === this.action.member.id){
            embed.title = 'Joined Organization "' + this.action.data.organization.name + '"';
        } else {
             embed.title = 'Added User to Organization "' + this.action.data.organization.name + '"';
            Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
            embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        }
        embed.url = this._resolveGenericURL(this.action.data.organization.id);
        this.payload.addEmbed(embed);
    }

    async addToOrganizationBoard(){
        let embed = this._preparePayload();
        embed.title = 'Created Board in "' + this.action.data.organization.name + '"';
        embed.description = '[`' + this.action.data.board.name + '`](' + this._resolveFullBoardURL(action.data.board) + ') has been created.';
        embed.url = this._resolveGenericURL(this.action.data.organization.id);
        this.payload.addEmbed(embed);
    }

    async commentCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Commented on Card "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCommentURL(this.action.data.card, this.action.id);
        embed.description = Trello._formatLargeString(this.action.data.text);
        this.payload.addEmbed(embed);
    }

    async convertToCardFromCheckItem(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Converted Check Item to Card';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        embed.description = '`' + this.action.data.card.name + '` from card [`' + this.action.data.cardSource.name + '`](' + this._resolveFullCardURL(this.action.data.cardSource) + ') has been converted to a card.';
        this.payload.addEmbed(embed);
    }

    async copyBoard(){
        let embed = this._preparePayload();
        embed.title = 'Copied Board';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        embed.description = '`' + this.action.data.board.name + '` has been copied from [another board](' + this._resolveBoardURL(this.action.data.boardSource.id) + ').'
        this.payload.addEmbed(embed);
    }

    async copyCard(){
        let embed = this._preparePayload();
        embed.title = 'Copied Card';
        embed.description = '[`' + this.action.data.cardSource.name + '`](' + this._resolveFullCardURL(this.action.data.cardSource) + ') \uD83E\uDC6A [`' + this.action.data.card.name + '``](' + this._resolveFullCardURL(this.action.data.card) + ')';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this.payload.addEmbed(embed);
    }

    async copyChecklist(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Copied Checklist';
        embed.description = '`' + this.action.data.checklistSource.name + '` \uD83E\uDC6A `' + this.action.data.checklist.name + '`';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async createLabel(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Created Label';
        this._formatLabel(this.action.data.label.name, this.action.data.label.color, embed);
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async copyCommentCard(){
        
    }

    async createBoard(){
        let embed = this._preparePayload();
        embed.title = 'Created Board "' + Trello._formatLargeString(this.action.data.board.name) + '"';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    // Won't Trigger?
    async createBoardInvitation(){
        
    }

    // How to Trigger?
    async createBoardPreference(){
        
    }

    async createCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Created Card';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        embed.description = '`' + this.action.data.card.name + '` has been created in list `' + this.action.data.list.name + '`.';
        this.payload.addEmbed(embed);
    }

    async createCheckItem(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Created Check Item in "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        embed.description = '`' + this.action.data.checkItem.name + '` was added to checklist `' + this.action.data.checklist.name + '`.';
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async createChecklist(){
        
    }

    async createList(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Created List';
        embed.description = '`' + this.action.data.list.name + '` has been created.';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async createOrganization(){
        let embed = this._preparePayload();
        embed.title = 'Created Organization';
        embed.description = '`' + this.action.data.organization.name + '` has been created.';
        embed.url = this._resolveGenericURL(this.action.data.organization.id);
        this.payload.addEmbed(embed);
    }

    // Won't Trigger?
    async createOrganizationInvitation(){
        
    }

    async deleteAttachmentFromCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Removed Attachment from "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this._formatAttachment(this.action.data.attachment, embed);
        this.payload.addEmbed(embed);
    }

    // Won't Trigger?
    async deleteBoardInvitation(){
        
    }

    async deleteCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Deleted Card';
        embed.description = 'A card was deleted from list `' + this.action.data.list.name + '`.';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async deleteCheckItem(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Deleted Check Item from "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        embed.description = '`' + this.action.data.checkItem.name + '` was removed from checklist `' + this.action.data.checklist.name + '`.';
        this.payload.addEmbed(embed);
    }

    async deleteLabel(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Deleted Label';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    // Won't Trigger?
    async deleteOrganizationInvitation(){
        
    }

    async disablePlugin(){
        let embed = this._preparePayload();
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        const opts = {
            uri: this.action.data.plugin.url,
            json: true
        }
        try {
            const manifest = await rpn(opts);
            const desc = Trello._formatMarkdown(manifest.details, embed);
            embed.title = '[' + this.action.data.board.name + '] Disabled Plugin \u2717';
            embed.fields = [{
                name: manifest.name,
                value: desc,
                inline: false
            }];
            embed.thumbnail = {
                url: urlMod.resolve(opts.uri, manifest.icon.url)
            }
        } catch (err) {
            console.log('[Trello Provider] Error while retrieving plugin manifest.');
            console.log(err);
            embed.title = '[' + this.action.data.board.name + '] Disabled Plugin "' + this.action.data.plugin.name + '"';
        }
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async disablePowerUp(){
        
    }

    // How to Trigger?
    async emailCard(){
        
    }

    async enablePlugin(){
        let embed = this._preparePayload();
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        const opts = {
            uri: this.action.data.plugin.url,
            json: true
        }
        try {
            const manifest = await rpn(opts);
            const desc = Trello._formatMarkdown(manifest.details, embed);
            embed.title = '[' + this.action.data.board.name + '] Enabled Plugin \u2713';
            embed.fields = [{
                name: manifest.name,
                value: desc,
                inline: false
            }];
            embed.thumbnail = {
                url: urlMod.resolve(opts.uri, manifest.icon.url)
            }
        } catch (err) {
            console.log('[Trello Provider] Error while retrieving plugin manifest.');
            console.log(err);
            embed.title = '[' + this.action.data.board.name + '] Enabled Plugin "' + this.action.data.plugin.name + '"';
        }
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async enablePowerUp(){

    }

    async makeAdminOfBoard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Set User to Admin';
        embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async makeAdminOfOrganization(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.organization.name + '] Set User to Admin';
        embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
        embed.url = this._resolveGenericURL(this.data.organization.id);
        this.payload.addEmbed(embed);
    }

    async makeNormalMemberOfBoard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Set User to Member';
        embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async makeNormalMemberOfOrganization(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.organization.name + '] Set User to Member';
        embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
        embed.url = this._resolveGenericURL(this.data.organization.id);
        this.payload.addEmbed(embed);
    }
    
    //Unable to test, business class+ feature.
    async makeObserverOfBoard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Set User to Observer';
        embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async memberJoinedTrello(){
        
    }

    async moveCardFromBoard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Moved Card to Another Board';
        embed.description = '[`' + this.action.data.card.name + '`](' + this._resolveCardURL(this.action.data.card.id) + ') has been moved from list `' + this.action.data.list.name + '` to [another board](' + this._resolveBoardURL(this.action.data.boardTarget.id) + ').';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async moveCardToBoard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Moved Card to Board';
        embed.description = '[`' + this.action.data.card.name + '`](' + this._resolveFullCardURL(this.action.data.card) + ') has been moved to list `' + this.action.data.list.name + '` from [another board](' + this._resolveBoardURL(this.action.data.boardSource.id) + ').';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async moveListFromBoard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Moved List to Another Board';
        embed.description = '`' + this.action.data.list.name + '` has been moved to [another board](' + this._resolveBoardURL(this.action.data.boardTarget.id) + ').';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async moveListToBoard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Moved List to Board';
        embed.description = '`' + this.action.data.list.name + '` has been moved from [another board](' + this._resolveBoardURL(this.action.data.boardSource.id) + ').';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async removeBoardsPinnedFromMember(){
        let embed = this._preparePayload();

        this.payload.addEmbed(embed);
    }

    async removeChecklistFromCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Removed Checklist from "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        embed.description = '`' + this.action.data.checklist.name + '` has been removed.';
        this.payload.addEmbed(embed);
    }

    async removeFromOrganizationBoard(){
        let embed = this._preparePayload();
        embed.title = 'Removed Board from "' + this.action.data.organization.name + '"';
        embed.description = '`' + this.action.data.board.name + '` has been deleted.';
        embed.url = this._resolveGenericURL(this.action.data.organization.id);
        this.payload.addEmbed(embed);
    }

    async removeLabelFromCard(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Removed Label from "' + this.action.data.card.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this._formatLabel(this.action.data.text, this.action.data.value, embed);
        this.payload.addEmbed(embed);
    }

    async removeMemberFromCard(){
        let embed = this._preparePayload();
        if(this.action.memberCreator.id === thos.action.member.id){
            embed.title = '[' + this.action.data.board.name + '] Left "' + this.action.data.card.name + '"';
        } else {
            embed.title = '[' + this.action.data.board.name + '] Removed User from "' + this.action.data.card.name + '"';
            Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
            embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        }
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this.payload.addEmbed(embed);
    }

    async removeMemberFromBoard(){
        let embed = this._preparePayload();
        if(this.action.memberCreator.id === this.action.member.id){
            embed.title = 'Left Board "' + this.action.data.board.name + '"';
        } else {
            embed.title = 'Removed User from Board "' + this.action.data.board.name + '"';
            embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
            Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
        }
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async removeMemberFromOrganization(){
        let embed = this._preparePayload();
        if(this.action.memberCreator.id === this.action.member.id){
            embed.title = 'Left Organization "' + this.action.data.organization.name + '"';
        } else {
            embed.title = 'Removed User from Organization "' + this.action.data.organization.name + '"';
            Trello._addMemberThumbnail(this.action.member.avatarHash, embed);
            embed.description = this.action.member.fullName + ' ([`' + this.action.member.username + '`](' + this.baseLink + this.action.member.username + '))';
        }
        embed.url = this._resolveGenericURL(this.action.data.organization.id);
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async unconfirmedBoardInvitation(){
        
    }

    // How to trigger?
    async unconfirmedOrganizationInvitation(){
        
    }

    // TODO
    async updateBoard(){
        //So many preferences x.x
    }

    // TODO
    async updateCard(){
        //So many preferences x.x
    }

    async updateCheckItem(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Renamed Item in Checklist "' + this.action.data.checklist.name + '"';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        embed.description = '`' + this.action.data.old.name + '` \uD83E\uDC6A `' + this.action.data.checkItem.name + '`';
        this.payload.addEmbed(embed);
    }

    async updateCheckItemStateOnCard(){
        let embed = this._preparePayload();
        const capitalized = this.action.data.checkItem.state.charAt(0).toUpperCase() + this.action.data.checkItem.state.slice(1);
        embed.title = '[' + this.action.data.board.name + '] Marked Item as ' + capitalized;
        if(this.action.data.checkItem.state === 'complete'){
            embed.title = embed.title + ' `\u2714`';
        } else if(this.action.data.checkItem.state === 'incomplete'){
            embed.title = embed.title + ' `\u2718`';
        }
        embed.description = 'Item `' + this.action.data.checkItem.name + '` in `' + this.action.data.checklist.name + '` has been marked as `' + this.action.data.checkItem.state + '`.';
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this.payload.addEmbed(embed);
    }

    async updateChecklist(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Renamed Checklist';
        embed.description = '`' + Trello._formatLargeString(this.action.data.old.name) + '` \uD83E\uDC6A `' + Trello._formatLargeString(this.action.data.checklist.name) + '`';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    async updateLabel(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Updated Label';
        let field = {};
        if(this.action.data.old != null){
            if(this.action.data.old.color != null){
                if(this.action.data.label.color){
                    field = {
                        name: 'Changed Color',
                        value: '`' + this.action.data.old.color + '` \uD83E\uDC6A `' + this.action.data.label.color + '`',
                        inline: false
                    };
                 } else {
                        field = {
                        name: 'Removed Color',
                        value: 'Old color - `' + this.action.data.old.color + '`',
                        inline: false
                    };
                }
            } else if(this.action.data.old.name != null){
                if(this.action.data.old.name){
                    if(this.action.data.label.name){
                        field = {
                            name: 'Changed Name',
                            value: '`' + this.action.data.old.name + '` \uD83E\uDC6A `' + this.action.data.label.name + '`',
                            inline: false
                        };
                    } else {
                        field = {
                            name: 'Removed Name',
                            value: 'Old name - `' + this.action.data.old.name + '`',
                            inline: false
                        };
                    }
                } else {
                    field = {
                        name: 'Added Name',
                        value: '`' + this.action.data.label.name + '`',
                        inline: false
                    };
                }
            }
        } else {
            field = {
                name: 'Added Color',
                value: '`' + this.action.data.label.color + '`',
                inline: false
            };
        }
        embed.fields = [field];
        this.payload.addEmbed(embed);
    }

    async updateList(){
        let embed = this._preparePayload();
        embed.title = '[' + this.action.data.board.name + '] Renamed List';
        embed.description = '`' + this.action.data.old.name + '` \uD83E\uDC6A `' + this.action.data.list.name + '`';
        embed.url = this._resolveFullBoardURL(this.action.data.board);
        this.payload.addEmbed(embed);
    }

    // How to Trigger?
    async updateMember(){
        
    }

    async updateOrganization(){
        let embed = this._preparePayload();
        let field = null;
        const organization = this.action.data.organization;
        const old = this.action.data.old;
        if(old != null){
            if(old.prefs != null){
                //Check Prefs
                if(old.prefs.permissionLevel != null){
                    field = {
                        name: 'Changed Permission Level of ' + organization.name,
                        value: '`' + old.prefs.permissionLevel + '` \uD83E\uDC6A `' + organization.prefs.permissionLevel + '`',
                        inline: false
                    }
                };
            } else if(old.displayName != null){
                field = {
                    name: 'Changed Name of ' + organization.name,
                    value: '`' + old.displayName + '` \uD83E\uDC6A `' + organization.displayName + '`',
                    inline: false
                };
            } else if(old.name != null){
                field = {
                    name: 'Changed Short Name of ' + organization.name,
                    value: '`' + old.name + '` \uD83E\uDC6A `' + this.model.name + '`',
                };
            } else if(old.website != null){
                //If new value is empty, organization.website is null
                if(organization.website == null){
                    field = {
                        name: 'Removed Website from ' + organization.name,
                        value: 'Old value - ' + old.website,
                        inline: false
                    };
                } else {
                    field = {
                        name: 'Changed Website of ' + organization.name,
                        value: old.website + ' \uD83E\uDC6A ' + organization.website,
                        inline: false
                    };
                }
            } else if(old.desc != null){
                field = {
                name: 'Changed Description of ' + organization.name,
                value: Trello._formatLargeString(old.desc) + '\n`\uD83E\uDC6B`\n' + Trello._formatLargeString(organization.desc),
                };
            }
        } else {
            //Must have been a website update.
            field = {
                name: 'Added Website to ' + organization.name,
                value: organization.website,
                inline: false
            };
        }
        embed.fields = [field];
        this.payload.addEmbed(embed);
    }

    async voteOnCard(){
        let embed = this._preparePayload();
        if(this.action.data.voted){
            embed.title = '[' + this.action.data.board.name + '] Voted on Card "' + this.action.data.card.name + '" \u2705';
        } else {
            embed.title = '[' + this.action.data.board.name + '] Removed Vote on Card "' + this.action.data.card.name + '"';
        }
        embed.url = this._resolveFullCardURL(this.action.data.card);
        this.payload.addEmbed(embed);
    }
}

module.exports = Trello;