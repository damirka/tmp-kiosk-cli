module registry::registry {
    use sui::object::{Self, UID};
    use sui::tx_context::{sender, TxContext};
    use sui::package;

    struct REGISTRY has drop {}
    struct Item has key, store { id: UID }

    fun init(otw: REGISTRY, ctx: &mut TxContext) {
        package::claim_and_keep(otw, ctx);
        sui::transfer::public_transfer(Item { id: object::new(ctx) }, sender(ctx))
    }
}
