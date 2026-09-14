<x-guest-layout variant="reset-password">
    <main class="flex min-h-screen items-center justify-center bg-[#f3f6fb] px-5 py-10 text-[#061633]">
        <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_16px_45px_rgba(15,23,42,0.12)]">
            <a href="/" class="mx-auto mb-6 flex w-max items-center gap-3">
                <img src="{{ Vite::asset('resources/js/react/assets/Logo.png') }}" alt="LNU logo" class="h-12 w-12 object-contain">
                <span class="text-xl font-black text-[#10245a]">LNU-HiRe</span>
            </a>

            <div class="mb-6 text-center">
                <h1 class="text-2xl font-black">Reset Password</h1>
                <p class="mt-2 text-sm leading-6 text-[#667085]">
                    Create a new password for your account.
                </p>
            </div>

            <form method="POST" action="{{ route('password.store') }}" class="space-y-4">
                @csrf

                <input type="hidden" name="token" value="{{ $request->route('token') }}">
                <input type="hidden" name="account_type" value="{{ old('account_type', $request->query('account_type', 'users')) }}">

                <div>
                    <x-input-label for="email" :value="__('Email')" class="mb-2 text-sm font-bold text-[#17243d]" />
                    <x-text-input
                        id="email"
                        class="block h-12 w-full rounded-lg border-[#cbd5e1] px-4 text-base shadow-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                        type="email"
                        name="email"
                        :value="old('email', $request->email)"
                        required
                        autofocus
                        autocomplete="username"
                    />
                    <x-input-error :messages="$errors->get('email')" class="mt-2" />
                </div>

                <div>
                    <x-input-label for="password" :value="__('New Password')" class="mb-2 text-sm font-bold text-[#17243d]" />
                    <x-text-input
                        id="password"
                        class="block h-12 w-full rounded-lg border-[#cbd5e1] px-4 text-base shadow-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                        type="password"
                        name="password"
                        required
                        autocomplete="new-password"
                    />
                    <x-input-error :messages="$errors->get('password')" class="mt-2" />
                </div>

                <div>
                    <x-input-label for="password_confirmation" :value="__('Confirm Password')" class="mb-2 text-sm font-bold text-[#17243d]" />
                    <x-text-input
                        id="password_confirmation"
                        class="block h-12 w-full rounded-lg border-[#cbd5e1] px-4 text-base shadow-sm focus:border-[#2563eb] focus:ring-[#2563eb]"
                        type="password"
                        name="password_confirmation"
                        required
                        autocomplete="new-password"
                    />
                    <x-input-error :messages="$errors->get('password_confirmation')" class="mt-2" />
                </div>

                <button
                    type="submit"
                    class="flex h-12 w-full items-center justify-center rounded-lg bg-[#10245a] px-5 text-sm font-black uppercase tracking-wide text-white transition hover:bg-[#17357f] focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                    Reset Password
                </button>

            </form>
        </div>
    </main>
</x-guest-layout>
