<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_allowed_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('domain');
            $table->timestamps();

            $table->unique('domain');
            $table->index('company_id');
        });

        $companies = DB::table('companies')->orderBy('id')->select('id', 'allowed_domains')->get();
        $seen = [];
        $domainsByCompany = [];

        foreach ($companies as $company) {
            $domains = json_decode((string) $company->allowed_domains, true);
            if (! is_array($domains)) {
                $domainsByCompany[$company->id] = [];

                continue;
            }

            $kept = [];

            foreach ($domains as $domain) {
                if (! is_string($domain)) {
                    continue;
                }

                $normalized = $this->normalizeDomain($domain);
                if ($normalized === '' || isset($seen[$normalized])) {
                    continue;
                }

                $seen[$normalized] = true;
                $kept[] = $normalized;

                DB::table('company_allowed_domains')->insert([
                    'company_id' => $company->id,
                    'domain' => $normalized,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $domainsByCompany[$company->id] = $kept;
        }

        foreach ($domainsByCompany as $companyId => $domains) {
            DB::table('companies')->where('id', $companyId)->update([
                'allowed_domains' => json_encode(array_values($domains)),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('company_allowed_domains');
    }

    private function normalizeDomain(string $domain): string
    {
        $domain = strtolower(trim($domain));
        $domain = ltrim($domain, '@');
        $domain = rtrim($domain, '.');

        return $domain;
    }
};
