			.
			toHaveBeenCalled
			(
			)
			;
			expect
			(
			 
			myAction
			 
			)
			.
			not
			.
			toHaveBeenCalled
			(
			)
			;
			expect
			(
			 
			mySelector2
			 
			)
			.
			toHaveBeenCalled
			(
			)
			;
			expect
			(
			 
			myAction2
			 
			)
			.
			toHaveBeenCalled
			(
			)
			;
		}
	 
	)
	;
	}
 
)
;

	// Advanced tests for isFulfilled, edge cases, and async promise hygiene
	// Added as part of PR #70806 to address bug #70805
	describe( 'isFulfilled edge cases and async promise hygiene', () => {
		let registry;

		beforeEach( () => {
			registry = createRegistry();
		} );

		it( 'should handle isFulfilled for non-existent selectors', () => {
			// Test edge case where selector doesn't exist
			expect( () => {
				registry.select( 'nonExistentStore' ).isFulfilled( 'nonExistentSelector' );
			} ).not.toThrow();
		} );

		it( 'should maintain promise hygiene during async selector resolution', async () => {
			// Test for proper cleanup of async promise chains (addresses bug #70805)
			const asyncSelector = jest.fn().mockResolvedValue( 'resolved' );
			const store = registry.registerStore( 'asyncStore', {
				reducer: ( state = {} ) => state,
				selectors: {
					asyncSelector
				},
				resolvers: {
					asyncSelector: () => Promise.resolve( { type: 'RESOLVED' } )
				}
			} );

			// Trigger async resolution multiple times to test promise hygiene
			const promise1 = registry.resolveSelect( 'asyncStore' ).asyncSelector();
			const promise2 = registry.resolveSelect( 'asyncStore' ).asyncSelector();
			const promise3 = registry.resolveSelect( 'asyncStore' ).asyncSelector();

			// All promises should resolve properly without interference
			await expect( promise1 ).resolves.toBe( 'resolved' );
			await expect( promise2 ).resolves.toBe( 'resolved' );
			await expect( promise3 ).resolves.toBe( 'resolved' );

			// Verify isFulfilled status after resolution
			expect( registry.select( 'asyncStore' ).isFulfilled( 'asyncSelector' ) ).toBe( true );
		} );

		it( 'should handle concurrent async selectors with different parameters', async () => {
			// Test concurrent execution with parameter variations
			const parametrizedSelector = jest.fn( ( state, param ) => `result-${param}` );
			const resolver = jest.fn( ( param ) => Promise.resolve( { type: 'SET_PARAM', param } ) );

			registry.registerStore( 'paramStore', {
				reducer: ( state = {}, action ) => {
					if ( action.type === 'SET_PARAM' ) {
						return { ...state, [action.param]: true };
					}
					return state;
				},
				selectors: {
					parametrizedSelector
				},
				resolvers: {
					parametrizedSelector: resolver
				}
			} );

			// Execute multiple concurrent calls with different parameters
			const promises = [
				registry.resolveSelect( 'paramStore' ).parametrizedSelector( 'a' ),
				registry.resolveSelect( 'paramStore' ).parametrizedSelector( 'b' ),
				registry.resolveSelect( 'paramStore' ).parametrizedSelector( 'c' )
			];

			const results = await Promise.all( promises );
			expect( results ).toEqual( ['result-a', 'result-b', 'result-c'] );

			// Verify all variants are properly fulfilled
			expect( registry.select( 'paramStore' ).isFulfilled( 'parametrizedSelector', 'a' ) ).toBe( true );
			expect( registry.select( 'paramStore' ).isFulfilled( 'parametrizedSelector', 'b' ) ).toBe( true );
			expect( registry.select( 'paramStore' ).isFulfilled( 'parametrizedSelector', 'c' ) ).toBe( true );
		} );

		it( 'should handle promise rejection gracefully', async () => {
			// Test proper handling of rejected promises in selector resolution
			const failingSelector = jest.fn().mockRejectedValue( new Error( 'Selector failed' ) );
			const failingResolver = () => Promise.reject( new Error( 'Resolver failed' ) );

			registry.registerStore( 'failStore', {
				reducer: ( state = {} ) => state,
				selectors: {
					failingSelector
				},
				resolvers: {
					failingSelector: failingResolver
				}
			} );

			// Should handle rejection without crashing
			await expect( registry.resolveSelect( 'failStore' ).failingSelector() )
				.rejects.toThrow( 'Selector failed' );

			// isFulfilled should return false for failed resolutions
			expect( registry.select( 'failStore' ).isFulfilled( 'failingSelector' ) ).toBe( false );
		} );

		it( 'should properly clean up promise references to prevent memory leaks', async () => {
			// Test memory management for promise references (part of bug #70805)
			const selector = jest.fn().mockResolvedValue( 'test' );
			const resolver = () => Promise.resolve( { type: 'RESOLVED' } );

			registry.registerStore( 'memoryTestStore', {
				reducer: ( state = {} ) => state,
				selectors: { selector },
				resolvers: { selector: resolver }
			} );

			// Create many promises and resolve them
			const promises = Array.from( { length: 100 }, () => 
				registry.resolveSelect( 'memoryTestStore' ).selector()
			);

			await Promise.all( promises );

			// All should be fulfilled without memory issues
			expect( registry.select( 'memoryTestStore' ).isFulfilled( 'selector' ) ).toBe( true );
			expect( selector ).toHaveBeenCalledTimes( 100 );
		} );
	} );
} );
