export = CConfirmation;
declare function CConfirmation(community: any, data: any): void;
declare class CConfirmation {
    constructor(community: any, data: any);
    id: any;
    type: any;
    creator: any;
    key: any;
    title: any;
    receiving: any;
    time: any;
    icon: any;
    offerID: any;
    getOfferID(time: any, key: any, callback: any): void;
    respond(time: any, key: any, accept: any, callback: any): void;
}
