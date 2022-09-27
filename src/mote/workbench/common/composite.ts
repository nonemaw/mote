export interface IComposite {

	/**
	 * Returns the unique identifier of this composite.
	 */
	getId(): string;

	/**
	 * Asks the underlying control to focus.
	 */
	focus(): void;
}
