import type { AppContext } from "@openlocale/api";
import type { User } from "@openlocale/db";

declare global {
	namespace App {
		interface Locals {
			ctx: AppContext;
			user: User | null;
		}
	}
}

export {};
