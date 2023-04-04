// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module artybara::artybara {
    use std::option::some;
    use sui::tx_context::TxContext;
    use collectible::collectible;

    struct ARTYBARA has drop {}
    struct Artybara has store {}

    fun init(otw: ARTYBARA, ctx: &mut TxContext) {
        collectible::claim_ticket<
            ARTYBARA,
            Artybara
        >(otw, some(10u32), ctx)
    }
}
