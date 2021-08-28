export = CEconItem;
declare function CEconItem(item: any, description: any, contextID: any): void;
declare class CEconItem {
    constructor(item: any, description: any, contextID: any);
    currencyid: any;
    id: any;
    assetid: any;
    instanceid: string;
    amount: number;
    contextid: any;
    is_currency: boolean;
    tradable: boolean;
    marketable: boolean;
    commodity: boolean;
    market_tradable_restriction: number;
    market_marketable_restriction: number;
    fraudwarnings: any[];
    descriptions: any[];
    owner: any;
    tags: any;
    market_fee_app: number;
    cache_expiration: any;
    actions: any[];
    getImageURL(): string;
    getLargeImageURL(): string;
    getTag(category: any): any;
}
