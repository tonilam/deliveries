<?php

namespace App\Http\Requests;

use App\Enums\LoadType;
use App\Http\Requests\Concerns\ValidatesLoadPayload;
use App\Models\Load;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateLoadRequest extends FormRequest
{
    use ValidatesLoadPayload;

    public function authorize(): bool
    {
        $load = $this->route('load');

        return $load instanceof Load && ($this->user()?->can('update', $load) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $load = $this->route('load');
        if ($load instanceof Load && $load->type !== LoadType::Direct) {
            return array_merge(
                [
                    'delivery_address_id' => $this->childLoadFieldRules($load->type)['delivery_address_id'],
                    'pallet_count' => ['required', 'integer', 'min:0'],
                    'xdock_address_id' => $load->type === LoadType::XDock
                        ? $this->childLoadFieldRules(LoadType::XDock)['xdock_address_id']
                        : ['prohibited'],
                    'secondary_provider_company_id' => $load->type === LoadType::XDock
                        ? $this->childLoadFieldRules(LoadType::XDock)['secondary_provider_company_id']
                        : ['prohibited'],
                    'vehicle_body_type_id' => ['prohibited'],
                    'vehicle_option_values' => ['prohibited'],
                ],
                $this->scheduleFieldRules(),
            );
        }

        return $this->directLoadFieldRules();
    }

    public function withValidator(Validator $validator): void
    {
        $load = $this->route('load');
        if (! $load instanceof Load) {
            return;
        }

        if ($load->type === LoadType::Direct) {
            $this->withDirectLoadValidator($validator, $load);
        } else {
            $this->withChildUpdateValidator($validator, $load);
        }
    }
}
