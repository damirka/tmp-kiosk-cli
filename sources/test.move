module test::test {
    use std::vector;
    use std::string::utf8;
    use sui::object::{Self, UID};
    use sui::tx_context::{sender, TxContext};
    use sui::transfer_policy;
    use sui::transfer;
    use sui::package;
    use sui::display;
    use sui::hex;

    struct TEST has drop {}
    struct TestItem has key, store { id: UID }

    fun init(otw: TEST, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        let (policy, cap) = transfer_policy::new<TestItem>(&publisher, ctx);
        let display = display::new<TestItem>(&publisher, ctx);
        let policy_id = object::id_bytes(&policy);

        let description = b"This is a test item which features an empty TransferPolicy\n0x";
        vector::append(&mut description, hex::encode(policy_id));

        display::add(&mut display, utf8(b"name"), utf8(b"Test Item (no royalty)"));
        display::add(&mut display, utf8(b"link"), utf8(b"https://suiexplorer.com/object/{id}?network=testnet"));
        display::add(&mut display, utf8(b"description"), utf8(description));

        display::update_version(&mut display);
        transfer::public_transfer(display, sender(ctx));
        package::burn_publisher(publisher);
        sui::transfer::public_share_object(policy);
        sui::transfer::public_transfer(cap, sender(ctx));
    }

    public fun mint(ctx: &mut TxContext): TestItem {
        TestItem { id: object::new(ctx) }
    }

    entry fun mint_and_keep(ctx: &mut TxContext) {
        sui::transfer::transfer(
            TestItem { id: object::new(ctx) },
            sender(ctx)
        );
    }
}
