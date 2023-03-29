module registry::registry {
    use sui::object::{Self, UID};
    use sui::tx_context::{sender, TxContext};

    struct Registry has key, store { id: UID }

    fun init(ctx: &mut TxContext) {
        sui::transfer::public_transfer(Registry { id: object::new(ctx) }, sender(ctx))
    }
}
