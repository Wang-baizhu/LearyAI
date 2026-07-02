// Responsibility: 通过阿里云 Dysms API 发送短信验证码。
package com.notebook.learyAI.module.auth.infrastructure.sms;

import com.aliyun.dypnsapi20170525.Client;
import com.aliyun.dypnsapi20170525.models.SendSmsVerifyCodeRequest;
import com.aliyun.dypnsapi20170525.models.SendSmsVerifyCodeResponse;
import com.aliyun.dypnsapi20170525.models.SendSmsVerifyCodeResponseBody;
import com.aliyun.tea.TeaException;
import com.aliyun.teaopenapi.models.Config;
import com.aliyun.teautil.models.RuntimeOptions;
import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.port.SmsSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class AliyunSmsClient implements SmsSender {
    private static final Logger log = LoggerFactory.getLogger(AliyunSmsClient.class);
    private static final String SUCCESS_CODE = "OK";

    private final AuthProperties.Aliyun aliyun;
    private final Client client;

    public AliyunSmsClient(AuthProperties authProperties) {
        this.aliyun = authProperties.getSms().getAliyun();
        this.client = createClient();
    }

    @Override
    public boolean send(String phone, String code) {
        if (client == null) {
            log.error("Aliyun SMS client is not initialized");
            return false;
        }
        if (phone == null || phone.isBlank() || code == null || code.isBlank()) {
            log.warn("Aliyun SMS skipped because phone or code is blank (phone={}, codeProvided={})",
                    phone, code != null && !code.isBlank());
            return false;
        }
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest()
                .setPhoneNumber(phone)
                .setCountryCode(aliyun.getCountryCode())
                .setSignName("云渚科技验证平台")
                .setTemplateCode(aliyun.getTemplateCode());
        String templateParam = buildTemplateParam(code);
        if (templateParam != null) {
            request.setTemplateParam(templateParam);
        }

        RuntimeOptions runtime = new RuntimeOptions();
        try {
            SendSmsVerifyCodeResponse response = client.sendSmsVerifyCodeWithOptions(request, runtime);
            SendSmsVerifyCodeResponseBody body = response.getBody();
            if (body == null) {
                log.error("Aliyun SMS response body is empty for {}", phone);
                return false;
            }
            if (!SUCCESS_CODE.equals(body.getCode())) {
                log.error("Aliyun SMS API returned {} - {} for {}", body.getCode(), body.getMessage(), phone);
                return false;
            }
            log.debug("Aliyun SMS sent to {}", phone);
            return true;
        } catch (TeaException error) {
            log.error("Aliyun SMS SDK error for {}", phone, error);
        } catch (Exception error) {
            log.error("Unexpected Aliyun SMS error for {}", phone, error);
        }
        return false;
    }

    private Client createClient() {
        if (aliyun == null) {
            log.warn("Aliyun SMS configuration is missing");
            return null;
        }
        if (aliyun.getAccessKeyId() == null || aliyun.getAccessKeySecret() == null) {
            log.warn("Aliyun SMS credentials are not configured");
            return null;
        }
        try {
            Config config = new Config()
                    .setType("access_key")
                    .setAccessKeyId(aliyun.getAccessKeyId())
                    .setRegionId(aliyun.getRegion())
                    .setAccessKeySecret(aliyun.getAccessKeySecret())
                    .setEndpoint(aliyun.getEndpoint());
            String securityToken = aliyun.getSecurityToken();
            if (securityToken != null && !securityToken.isBlank()) {
                config.setSecurityToken(securityToken);
            }
            return new Client(config);
        } catch (Exception error) {
            log.error("Failed to init Aliyun SMS client", error);
            return null;
        }
    }

    private String buildTemplateParam(String code) {
        String template = aliyun.getTemplateParam();
        if (template == null || template.isBlank()) {
            return null;
        }
        int minMinutes = Math.max(0, aliyun.getMinMinutes());
        return template
                .replace("{code}", code)
                .replace("{min}", String.valueOf(minMinutes));
    }
}
